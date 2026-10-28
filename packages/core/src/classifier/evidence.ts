import { overlapping } from "../ledger/queries.js";
import type { EffectAttempt } from "../ledger/types.js";
import type { CaseResult } from "../scenario/result.js";
import type { Evidence, WorkflowStateForEvidence } from "./types.js";

const counts = (a: Readonly<EffectAttempt>) =>
	a.status === "applied" || a.status === "deduplicated";

/**
 * Expected attempt count per identity: applied + deduplicated attempts in the baseline.
 *
 * @example
 * expectedCounts(result.baseline).get("payment::o-1"); // 1
 */
export function expectedCounts(baseline: CaseResult): Map<string, number> {
	const expected = new Map<string, number>();
	for (const a of baseline.ledger.attempts) {
		if (counts(a)) expected.set(a.identity, (expected.get(a.identity) ?? 0) + 1);
	}
	return expected;
}

function workflowState(c: CaseResult): WorkflowStateForEvidence {
	if (c.status !== "settled") return "unsettled";
	switch (c.final?.state) {
		case "completed":
			return "completed";
		case "failed":
			return "failed";
		case "waiting":
			return "waiting";
		default:
			return "unsettled";
	}
}

/**
 * Evidence per logical identity in a case (identities seen in the case first, then expected
 * identities that never appeared).
 *
 * @example
 * buildEvidence(caseResult, expectedCounts(result.baseline));
 */
export function buildEvidence(c: CaseResult, expected: ReadonlyMap<string, number>): Evidence[] {
	const state = workflowState(c);
	const faultIds = c.ledger.faults.map((f) => f.id);
	const identities = [
		...new Set([...c.ledger.attempts.map((a) => a.identity), ...expected.keys()]),
	];
	return identities.map((identity) => {
		const list = c.ledger.attempts.filter((a) => a.identity === identity);
		const [kind, ...rest] = identity.split("::");
		const appliedOnly = list.filter((a) => a.status === "applied");
		return {
			identity,
			kind: list[0]?.kind ?? (kind as string),
			subject: list[0]?.subject ?? rest.join("::"),
			attemptSeqs: list.map((a) => a.seq),
			applied: appliedOnly.length,
			deduplicated: list.filter((a) => a.status === "deduplicated").length,
			failed: list.filter((a) => a.status === "failed").length,
			expected: expected.get(identity) ?? 0,
			overlaps: overlapping(appliedOnly, identity).map(([a, b]) => [a.seq, b.seq]),
			keys: [
				...new Set(list.flatMap((a) => (a.idempotencyKey === undefined ? [] : [a.idempotencyKey]))),
			],
			unsettled: list.filter((a) => a.status === "started").map((a) => a.seq),
			workflowState: state,
			faultIds,
		};
	});
}
