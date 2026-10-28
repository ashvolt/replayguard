import fc from "fast-check";
import type { EffectAttempt, FaultEvent, LedgerSnapshot } from "../../src/ledger/types.js";
import type { RunOutcome } from "../../src/runtime/port.js";
import type { CaseResult, CaseStatus, ScenarioResult } from "../../src/scenario/result.js";

/** Compact attempt description for hand-built ledgers. */
export interface A {
	kind?: string;
	subject?: string;
	status?: EffectAttempt["status"];
	start?: number;
	end?: number | undefined;
	key?: string;
	run?: number;
}

export function attempts(list: readonly A[]): EffectAttempt[] {
	const kindCount = new Map<string, number>();
	const idCount = new Map<string, number>();
	return list.map((a, i) => {
		const kind = a.kind ?? "payment";
		const subject = a.subject ?? "o-1";
		const identity = `${kind}::${subject}`;
		kindCount.set(kind, (kindCount.get(kind) ?? 0) + 1);
		idCount.set(identity, (idCount.get(identity) ?? 0) + 1);
		const status = a.status ?? "applied";
		return {
			seq: i + 1,
			runIndex: a.run ?? 0,
			kind,
			subject,
			identity,
			kindOccurrence: kindCount.get(kind) as number,
			identityOccurrence: idCount.get(identity) as number,
			idempotencyKey: a.key,
			startedAt: a.start ?? i * 10,
			settledAt: "end" in a ? a.end : status === "started" ? undefined : (a.start ?? i * 10) + 1,
			status,
			error: status === "failed" ? { name: "Error", message: "declined" } : undefined,
			inFlightAtFaults: [],
			preview: undefined,
		};
	});
}

export function ledger(
	list: readonly A[],
	faults: readonly Partial<FaultEvent>[] = [],
): LedgerSnapshot {
	return {
		version: 1,
		attempts: attempts(list),
		faults: faults.map((f, i) => ({
			id: `F${i + 1}`,
			seq: i + 1,
			runIndex: 0,
			at: 0,
			strategy: "crash",
			anchor: "crash after payment#1",
			inFlight: [],
			...f,
		})),
		runs: [],
		finalized: true,
	};
}

export function caseResult(
	index: number,
	list: readonly A[],
	opts: {
		final?: RunOutcome | undefined;
		status?: CaseStatus;
		faults?: readonly Partial<FaultEvent>[];
		restarts?: number;
		name?: string;
	} = {},
): CaseResult {
	return {
		index,
		name: opts.name ?? (index === 0 ? "baseline" : `case ${index}`),
		origin: index === 0 ? "baseline" : "explicit",
		faults: [],
		faultOutcomes: [],
		status: opts.status ?? "settled",
		final: "final" in opts ? opts.final : { state: "completed", output: null },
		runs: (opts.restarts ?? 0) + 1,
		restarts: opts.restarts ?? 0,
		durationMs: 1,
		ledger: ledger(list, opts.faults),
		harnessError:
			opts.status === "harness-error" ? { name: "HarnessError", message: "boom" } : undefined,
	};
}

export function scenarioResult(baseline: CaseResult, cases: CaseResult[]): ScenarioResult {
	return {
		version: 1,
		scenario: { name: "s", runtime: "fake", workflowId: "wf", seed: 1 },
		baseline,
		cases,
		skipped: [],
		baselineClean: true,
		startedAt: 0,
		durationMs: 1,
	};
}

/** Random attempts over two identities with arbitrary statuses and intervals. */
export const arbAttempts = fc
	.array(
		fc.record({
			subject: fc.constantFrom("o-1", "o-2"),
			status: fc.constantFrom<EffectAttempt["status"]>(
				"applied",
				"deduplicated",
				"failed",
				"started",
			),
			start: fc.integer({ min: 0, max: 100 }),
			len: fc.integer({ min: 0, max: 50 }),
		}),
		{ maxLength: 8 },
	)
	.map((list) =>
		list.map((a) => ({
			subject: a.subject,
			status: a.status,
			start: a.start,
			end: a.status === "started" ? undefined : a.start + a.len,
		})),
	);

export const arbFinal = fc.constantFrom<RunOutcome | undefined>(
	{ state: "completed", output: null },
	{ state: "failed", error: { name: "E", message: "m" } },
	{ state: "waiting", names: [] },
	undefined,
);
