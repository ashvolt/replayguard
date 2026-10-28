import { HarnessError, type SerializedError, serializeError } from "../errors.js";
import { type ArmedFaults, DEFAULT_STRATEGIES, FaultController } from "../faults/controller.js";
import type { FaultSpec } from "../faults/types.js";
import { EffectLedger } from "../ledger/ledger.js";
import { type Clock, systemClock } from "../ports/clock.js";
import { type Sleeper, systemSleeper } from "../ports/sleeper.js";
import type { RunOutcome, RuntimeCase } from "../runtime/port.js";
import { createEffectContext } from "./context.js";
import { discoverOccurrences } from "./discovery.js";
import { buildMatrix } from "./matrix.js";
import type { CaseOrigin, CaseResult, CaseStatus, ScenarioResult, SkippedCase } from "./result.js";
import type { ScenarioDefinition } from "./types.js";

const TIMEOUT = Symbol("timeout");

/** Time and waiting ports for a scenario run. */
export interface RunOptions {
	/** Time source (default: system clock). */
	clock?: Clock;
	/** Waiting port (default: real timers). */
	sleeper?: Sleeper;
}

async function withDeadline<T>(
	promise: Promise<T>,
	remainingMs: number,
): Promise<T | typeof TIMEOUT> {
	promise.catch(() => undefined);
	if (remainingMs <= 0) return TIMEOUT;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<typeof TIMEOUT>((resolve) => {
		timer = setTimeout(() => resolve(TIMEOUT), remainingMs);
	});
	try {
		return await Promise.race([promise, timeout]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Runs a scenario: baseline, explicit cases, then explored cases — each through the same fixed
 * lifecycle (Template Method): prepare → arm → run/restart loop → settle → grace → snapshot.
 *
 * @example
 * const result = await new ScenarioRunner(definition).run();
 */
export class ScenarioRunner<TEffects, TWorkflow, TInput> {
	readonly #def: ScenarioDefinition<TEffects, TWorkflow, TInput>;
	readonly #clock: Clock;
	readonly #sleeper: Sleeper;

	constructor(
		definition: ScenarioDefinition<TEffects, TWorkflow, TInput>,
		options: RunOptions = {},
	) {
		this.#def = definition;
		this.#clock = options.clock ?? systemClock;
		this.#sleeper = options.sleeper ?? systemSleeper;
	}

	/** Runs every case sequentially and returns the raw results. */
	async run(): Promise<ScenarioResult> {
		const def = this.#def;
		const startedAt = this.#clock.now();
		const baseline = await this.runCase(0, "baseline", "baseline", []);
		const cases: CaseResult[] = [];
		for (const c of def.cases)
			cases.push(await this.runCase(cases.length + 1, c.name, "explicit", c.faults));
		let skipped: SkippedCase[] = [];
		if (def.explore) {
			const matrix = buildMatrix({
				occurrences: discoverOccurrences(baseline.ledger, def.explore.kinds),
				explore: def.explore,
				explicit: def.cases.map((c) => c.faults),
				processIsolated: def.runtime.processIsolated,
				seed: def.seed,
			});
			skipped = matrix.skipped;
			for (const c of matrix.cases)
				cases.push(await this.runCase(cases.length + 1, c.name, "explored", c.faults));
		}
		return {
			version: 1,
			scenario: {
				name: def.name,
				runtime: def.runtime.name,
				workflowId: def.workflowId,
				seed: def.seed,
			},
			baseline,
			cases,
			skipped,
			baselineClean: baseline.status === "settled" && baseline.final?.state === "completed",
			startedAt,
			durationMs: this.#clock.now() - startedAt,
		};
	}

	/** One case through the fixed lifecycle. */
	async runCase(
		index: number,
		name: string,
		origin: CaseOrigin,
		faults: readonly FaultSpec[],
	): Promise<CaseResult> {
		const def = this.#def;
		const clock = this.#clock;
		const start = clock.now();
		const ledger = new EffectLedger({ clock });
		const effectContext = createEffectContext(ledger, clock, this.#sleeper, index);
		let runtimeCase: RuntimeCase | undefined;
		let armed: ArmedFaults | undefined;
		let runs = 0;
		let restarts = 0;
		let final: RunOutcome | undefined;
		let status: CaseStatus = "settled";
		let harnessError: SerializedError | undefined;
		let active = false;
		try {
			runtimeCase = await def.runtime.prepareCase({
				workflowId: def.workflowId,
				input: def.input,
				caseIndex: index,
				ledger,
				effectContext,
				build: (ctx) => def.workflow(def.effects(ctx)),
				faults,
			});
			armed = new FaultController(def.runtime.strategies ?? DEFAULT_STRATEGIES).arm(faults, {
				ledger,
				persistence: runtimeCase.persistence,
				sleeper: this.#sleeper,
				processIsolated: def.runtime.processIsolated,
			});
			const pending = [...def.messages];
			const deadline = start + def.budget.caseTimeoutMs;
			for (;;) {
				if (runs >= def.budget.maxRuns) {
					status = "budget-exceeded";
					break;
				}
				runs++;
				const runIndex = ledger.beginRun();
				active = true;
				const outcome = await withDeadline(runtimeCase.runOnce(runIndex), deadline - clock.now());
				active = false;
				if (outcome === TIMEOUT) {
					ledger.endRun("budget");
					ledger.markRunDead(runIndex);
					runtimeCase.persistence.crash();
					status = "budget-exceeded";
					break;
				}
				if (outcome.state === "crashed") {
					ledger.endRun("crashed");
					runtimeCase.persistence.restart();
					restarts++;
					continue;
				}
				if (outcome.state === "sleeping") {
					ledger.endRun("yielded");
					const wait = Math.max(0, outcome.wakeAt - clock.now());
					if (clock.now() + wait > deadline) {
						status = "budget-exceeded";
						break;
					}
					await this.#sleeper.sleep(wait);
					continue;
				}
				if (outcome.state === "waiting") {
					ledger.endRun("waiting");
					const due = pending.filter((m) => m.afterRun === undefined || m.afterRun <= runIndex);
					if (due.length > 0) {
						if (!runtimeCase.deliver)
							throw new HarnessError(`runtime ${def.runtime.name} cannot deliver messages`);
						for (const message of due) {
							pending.splice(pending.indexOf(message), 1);
							await runtimeCase.deliver(message.name, message.body);
						}
						continue;
					}
					final = outcome;
					break;
				}
				ledger.endRun(outcome.state === "completed" ? "completed" : "failed");
				final = outcome;
				break;
			}
		} catch (error) {
			if (active) ledger.endRun("harness-error");
			status = "harness-error";
			harnessError = serializeError(error);
			final = undefined;
		}
		await this.#sleeper.sleep(def.budget.graceMs);
		const snapshot = ledger.finalize();
		const faultOutcomes = armed?.outcomes() ?? [];
		armed?.dispose();
		await runtimeCase?.dispose().catch(() => undefined);
		return {
			index,
			name,
			origin,
			faults,
			faultOutcomes,
			status,
			final,
			runs,
			restarts,
			durationMs: clock.now() - start,
			ledger: snapshot,
			harnessError,
		};
	}
}
