import type { Evidence, Outcome } from "./types.js";

/** One outcome rule (Specification pattern). */
export interface OutcomeRule {
	/** Outcome this rule assigns. */
	readonly outcome: Outcome;
	/** Whether the evidence satisfies the rule. */
	isSatisfiedBy(evidence: Evidence): boolean;
}

const allowed = (e: Evidence) => Math.max(e.expected, 1);

/** Rules in severity order; the first satisfied rule wins. */
export const OUTCOME_RULES: readonly OutcomeRule[] = [
	{
		outcome: "concurrent-duplicate",
		isSatisfiedBy: (e) => e.applied >= 2 && e.overlaps.length > 0,
	},
	{ outcome: "duplicated", isSatisfiedBy: (e) => e.applied > allowed(e) },
	{ outcome: "orphaned", isSatisfiedBy: (e) => e.applied >= 1 && e.workflowState === "failed" },
	{
		outcome: "skipped",
		isSatisfiedBy: (e) =>
			e.expected >= 1 && e.applied + e.deduplicated === 0 && e.workflowState === "completed",
	},
	{ outcome: "deduplicated", isSatisfiedBy: (e) => e.deduplicated >= 1 && e.applied <= allowed(e) },
	{ outcome: "exactly-once", isSatisfiedBy: (e) => e.applied + e.deduplicated >= 1 },
];

/** Outcomes from most to least severe. */
export const OUTCOME_SEVERITY: readonly Outcome[] = OUTCOME_RULES.map((r) => r.outcome);

/**
 * The outcome for the evidence, or `undefined` when nothing was applied and nothing is missing
 * (e.g. a declined effect in a failed workflow).
 *
 * @example
 * classifyEvidence(evidence); // "duplicated"
 */
export function classifyEvidence(evidence: Evidence): Outcome | undefined {
	return OUTCOME_RULES.find((rule) => rule.isSatisfiedBy(evidence))?.outcome;
}
