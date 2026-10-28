import type { FaultEvent } from "../ledger/types.js";
import type { CaseResult } from "../scenario/result.js";
import type { Evidence, Outcome } from "./types.js";

const label = (f: FaultEvent) => `Fault ${f.id} (${f.anchor})`;
const isCrash = (f: FaultEvent) => f.strategy === "crash" || f.strategy === "processKill";

function duplicatedCause(f: FaultEvent | undefined): string {
	if (!f)
		return " No injected fault explains it: the workflow called the effect more often than in the baseline.";
	if (isCrash(f)) {
		return ` ${label(f)} stopped run ${f.runIndex} after the effect applied but before the step result was saved; run ${f.runIndex + 1} re-executed the step.`;
	}
	if (f.strategy === "throwAfter") {
		return ` ${label(f)} hid the provider's response, so the step retried and called the provider again.`;
	}
	return ` ${label(f)} preceded the repeat.`;
}

/**
 * Deterministic causal explanation for an outcome.
 *
 * @example
 * explain(evidence, "duplicated", caseResult); // "payment applied 2× (expected 1). Fault F1 …"
 */
export function explain(e: Evidence, outcome: Outcome, c: CaseResult): string {
	const fault = c.ledger.faults[0];
	switch (outcome) {
		case "exactly-once":
			return e.applied <= 1
				? `${e.kind} applied once.`
				: `${e.kind} applied ${e.applied}× as in the baseline.`;
		case "deduplicated": {
			const key = e.keys[0] === undefined ? "" : ` (idempotency key "${e.keys[0]}")`;
			const applied = e.applied === 1 ? "applied once" : `applied ${e.applied}×`;
			return `${e.kind} was attempted ${e.applied + e.deduplicated}× and the provider deduplicated ${e.deduplicated} replay(s)${key}; ${applied}.`;
		}
		case "duplicated":
			return `${e.kind} applied ${e.applied}× (expected ${Math.max(e.expected, 1)}).${duplicatedCause(fault)}`;
		case "concurrent-duplicate": {
			const [a, b] = e.overlaps[0] as [number, number];
			const cause =
				fault?.strategy === "delay"
					? ` ${label(fault)} made the provider hang past the step timeout; the timed-out call kept running while the retry called the provider again.`
					: "";
			return `${e.kind} applied ${e.applied}× with overlapping calls: attempt #${a} was still in flight when attempt #${b} started.${cause}`;
		}
		case "orphaned": {
			const name = c.final?.state === "failed" ? ` (${c.final.error.name})` : "";
			const cause = !fault
				? ""
				: fault.strategy === "delay"
					? ` ${label(fault)} made the provider hang past the step timeout.`
					: ` ${label(fault)} preceded the failure.`;
			return `${e.kind} applied ${e.applied}× but the workflow ended "failed"${name}, so nothing records or compensates the effect.${cause}`;
		}
		case "skipped": {
			const cause = !fault
				? ""
				: fault.anchor.startsWith("lost request")
					? ` ${label(fault)} dropped the request and the workflow did not retry it.`
					: ` ${label(fault)} preceded the skip.`;
			return `${e.kind} was expected ${e.expected}× (baseline) but never applied, yet the workflow completed.${cause}`;
		}
	}
}
