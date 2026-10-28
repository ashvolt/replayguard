import { HarnessError, type SerializedError } from "../errors.js";
import { type Clock, systemClock } from "../ports/clock.js";
import { overlapping } from "./queries.js";
import type {
	AttemptStatus,
	EffectAttempt,
	EffectHooks,
	FaultEvent,
	LedgerEvent,
	LedgerSnapshot,
	PendingCall,
	RunEndReason,
	RunRecord,
} from "./types.js";

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

const copyAttempt = (a: EffectAttempt): EffectAttempt => ({
	...a,
	inFlightAtFaults: [...a.inFlightAtFaults],
});

/**
 * Ordered record of runs, effect attempts and injected faults for one test case (Observer
 * subject). Effects are recorded through `instrument()`; fault strategies attach `EffectHooks`.
 *
 * @example
 * const ledger = new EffectLedger();
 * const charge = instrument(ledger, stripe.charge, { kind: "payment" });
 * ledger.subscribe((event) => console.log(event.type));
 */
export class EffectLedger {
	readonly #clock: Clock;
	readonly #attempts: EffectAttempt[] = [];
	readonly #runs: RunRecord[] = [];
	readonly #faults: FaultEvent[] = [];
	readonly #observers = new Set<(event: LedgerEvent) => void>();
	readonly #hooks: EffectHooks[] = [];
	readonly #observerErrors: Error[] = [];
	#final: LedgerSnapshot | undefined;

	constructor(options: { clock?: Clock } = {}) {
		this.#clock = options.clock ?? systemClock;
	}

	/** Index of the latest run (0 before any run starts). */
	get currentRun(): number {
		return Math.max(0, this.#runs.length - 1);
	}

	/** Starts a new run (a fresh "process") and returns its index. */
	beginRun(): number {
		this.#assertOpen();
		const last = this.#runs.at(-1);
		if (last && last.endedAt === undefined)
			throw new HarnessError(`run ${last.runIndex} is still active`);
		const run: RunRecord = {
			runIndex: this.#runs.length,
			startedAt: this.#clock.now(),
			endedAt: undefined,
			endReason: undefined,
			dead: false,
		};
		this.#runs.push(run);
		this.#emit({ type: "run-started", run: { ...run } });
		return run.runIndex;
	}

	/** Ends the active run with a reason. */
	endRun(reason: RunEndReason): void {
		const run = this.#runs.at(-1);
		if (!run || run.endedAt !== undefined) throw new HarnessError("no active run to end");
		run.endedAt = this.#clock.now();
		run.endReason = reason;
		this.#emit({ type: "run-ended", run: { ...run } });
	}

	/** Marks a run as crashed: further instrumented calls in it throw `CrashSignal`. */
	markRunDead(runIndex: number): void {
		const run = this.#runs[runIndex];
		if (!run) throw new HarnessError(`unknown run ${runIndex}`);
		run.dead = true;
	}

	/** Whether the given run (default: current) was marked dead. */
	isRunDead(runIndex: number = this.currentRun): boolean {
		return this.#runs[runIndex]?.dead ?? false;
	}

	/**
	 * Describes the call that is about to start (occurrences count started attempts).
	 * @internal Used by `instrument()`.
	 */
	pendingCall(kind: string, subject: string, idempotencyKey: string | undefined): PendingCall {
		const identity = `${kind}::${subject}`;
		return {
			kind,
			subject,
			identity,
			kindOccurrence: this.#attempts.filter((a) => a.kind === kind).length + 1,
			identityOccurrence: this.#attempts.filter((a) => a.identity === identity).length + 1,
			idempotencyKey,
			runIndex: this.currentRun,
		};
	}

	/**
	 * Records a started attempt and notifies observers.
	 * @internal Used by `instrument()`.
	 */
	beginAttempt(call: PendingCall, preview: unknown): Readonly<EffectAttempt> {
		this.#assertOpen();
		const attempt: EffectAttempt = {
			...call,
			seq: this.#attempts.length + 1,
			startedAt: this.#clock.now(),
			settledAt: undefined,
			status: "started",
			error: undefined,
			inFlightAtFaults: [],
			preview,
		};
		this.#attempts.push(attempt);
		this.#emit({ type: "attempt-started", attempt: copyAttempt(attempt) });
		return attempt;
	}

	/**
	 * Settles a started attempt. Completions after `finalize()` are ignored.
	 * @internal Used by `instrument()`.
	 */
	settleAttempt(
		seq: number,
		status: Exclude<AttemptStatus, "started">,
		error: SerializedError | undefined,
	): void {
		if (this.#final) return;
		const attempt = this.#attempts[seq - 1];
		if (!attempt) throw new HarnessError(`unknown attempt ${seq}`);
		if (attempt.status !== "started") throw new HarnessError(`attempt ${seq} already settled`);
		attempt.status = status;
		attempt.error = error;
		attempt.settledAt = this.#clock.now();
		this.#emit({ type: "attempt-settled", attempt: copyAttempt(attempt) });
	}

	/** Records an injected fault and flags every attempt currently in flight. */
	recordFault(input: { strategy: string; anchor: string }): FaultEvent {
		const id = `F${this.#faults.length + 1}`;
		const inFlight = this.#attempts.filter((a) => a.status === "started");
		for (const attempt of inFlight) attempt.inFlightAtFaults.push(id);
		const fault: FaultEvent = {
			id,
			seq: this.#faults.length + 1,
			runIndex: this.currentRun,
			at: this.#clock.now(),
			strategy: input.strategy,
			anchor: input.anchor,
			inFlight: inFlight.map((a) => a.seq),
		};
		this.#faults.push(fault);
		this.#emit({ type: "fault", fault: { ...fault, inFlight: [...fault.inFlight] } });
		return fault;
	}

	/**
	 * Subscribes an observer. Observer errors are isolated (see `observerErrors()`) and never
	 * change control flow.
	 */
	subscribe(listener: (event: LedgerEvent) => void): () => void {
		this.#observers.add(listener);
		return () => this.#observers.delete(listener);
	}

	/** Registers control-flow hooks (fault strategies). Returns a remover. */
	addHooks(hooks: EffectHooks): () => void {
		this.#hooks.push(hooks);
		return () => {
			const i = this.#hooks.indexOf(hooks);
			if (i >= 0) this.#hooks.splice(i, 1);
		};
	}

	/**
	 * Registered hooks in registration order.
	 * @internal Used by `instrument()`.
	 */
	hooks(): readonly EffectHooks[] {
		return [...this.#hooks];
	}

	/** Errors thrown by observers (isolated from control flow). */
	observerErrors(): readonly Error[] {
		return [...this.#observerErrors];
	}

	/** Live view of all attempts in `seq` order. */
	attempts(): readonly Readonly<EffectAttempt>[] {
		return this.#attempts;
	}

	/** Attempts sharing a logical identity. */
	byIdentity(identity: string): readonly Readonly<EffectAttempt>[] {
		return this.#attempts.filter((a) => a.identity === identity);
	}

	/** Overlapping attempt pairs for an identity (see `overlapping()`). */
	overlapping(identity: string): [Readonly<EffectAttempt>, Readonly<EffectAttempt>][] {
		return overlapping(this.#attempts, identity);
	}

	/** Deep-frozen, JSON-serializable copy of the current state. */
	snapshot(): LedgerSnapshot {
		return (
			this.#final ??
			deepFreeze({
				version: 1,
				attempts: this.#attempts.map(copyAttempt),
				faults: this.#faults.map((f) => ({ ...f, inFlight: [...f.inFlight] })),
				runs: this.#runs.map((r) => ({ ...r })),
				finalized: false,
			})
		);
	}

	/** Freezes the ledger: later completions are ignored and no new runs or attempts start. */
	finalize(): LedgerSnapshot {
		if (!this.#final) this.#final = deepFreeze({ ...this.snapshot(), finalized: true });
		return this.#final;
	}

	#assertOpen(): void {
		if (this.#final) throw new HarnessError("ledger is finalized");
	}

	#emit(event: LedgerEvent): void {
		const frozen = deepFreeze(event);
		for (const observer of this.#observers) {
			try {
				observer(frozen);
			} catch (error) {
				this.#observerErrors.push(error instanceof Error ? error : new Error(String(error)));
			}
		}
	}
}
