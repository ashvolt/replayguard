import type { Evidence, Outcome, WorkflowStateForEvidence } from "../classifier/types.js";
import type { FaultSpec } from "../faults/types.js";
import type { FaultEvent } from "../ledger/types.js";
import type { FixHint } from "./fix-hint.js";

export type { FixHint };

/** What a hint rule knows about the case besides the evidence. */
export interface HintContext {
	/** Outcome being explained. */
	outcome: Outcome;
	/** Faults requested for the case. */
	faults: readonly FaultSpec[];
	/** Faults that fired. */
	faultEvents: readonly FaultEvent[];
	/** How the workflow ended. */
	finalState: WorkflowStateForEvidence;
}

/** A data-driven hint rule (Specification pattern). */
export interface HintRule {
	/** Hint ID. */
	id: string;
	/** Outcomes the rule applies to. */
	outcomes: readonly Outcome[];
	/** Whether the rule applies. */
	matches(evidence: Evidence, context: HintContext): boolean;
	/** The hint for this evidence. */
	render(evidence: Evidence, context: HintContext): FixHint;
}
