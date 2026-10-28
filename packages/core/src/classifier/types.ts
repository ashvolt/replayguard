import type { FixHint } from "../hints/types.js";
import type { ScenarioResult } from "../scenario/result.js";

/** What happened to one logical effect in one case. */
export type Outcome =
	| "exactly-once"
	| "deduplicated"
	| "duplicated"
	| "concurrent-duplicate"
	| "orphaned"
	| "skipped";

/** Verdict levels, from best to worst. */
export type VerdictLevel = "pass" | "warn" | "fail";

/** Workflow state as seen by the classifier. */
export type WorkflowStateForEvidence = "completed" | "failed" | "waiting" | "unsettled";

/** Facts about one logical effect in one case. */
export interface Evidence {
	/** Logical identity `kind::subject`. */
	identity: string;
	/** Effect kind. */
	kind: string;
	/** Effect subject. */
	subject: string;
	/** All attempt seqs of the identity in the case. */
	attemptSeqs: number[];
	/** Attempts the provider applied. */
	applied: number;
	/** Attempts the provider deduplicated. */
	deduplicated: number;
	/** Attempts that failed. */
	failed: number;
	/** Applied + deduplicated attempts in the baseline. */
	expected: number;
	/** Overlapping applied attempt pairs (seqs). */
	overlaps: [number, number][];
	/** Distinct idempotency keys used. */
	keys: string[];
	/** Attempts still in flight at finalization. */
	unsettled: number[];
	/** How the workflow ended. */
	workflowState: WorkflowStateForEvidence;
	/** Faults recorded in the case. */
	faultIds: string[];
}

/** Classification of one logical effect. */
export interface EffectClassification {
	/** Logical identity. */
	identity: string;
	/** Effect kind. */
	kind: string;
	/** Effect subject. */
	subject: string;
	/** Outcome. */
	outcome: Outcome;
	/** Verdict under the policy. */
	verdict: VerdictLevel;
	/** Supporting facts. */
	evidence: Evidence;
	/** Human-readable causal explanation. */
	explanation: string;
	/** Suggested fixes (non-passing outcomes). */
	hints: FixHint[];
}

/** Classification of one case. */
export interface CaseClassification {
	/** Case index (0 = baseline). */
	caseIndex: number;
	/** Case name. */
	name: string;
	/** Effects in first-seen order. */
	effects: EffectClassification[];
	/** Worst verdict of the case. */
	verdict: VerdictLevel;
	/** Notes that do not change outcomes. */
	warnings: string[];
}

/** Per-outcome verdict overrides. */
export type OutcomeVerdicts = Partial<Record<Outcome, VerdictLevel>>;

/** Verdict policy: built-in strict defaults with overrides. */
export interface Policy {
	/** Overrides for every effect. */
	default?: OutcomeVerdicts;
	/** Overrides by effect kind (exact or dotted prefix, longest wins). */
	kinds?: Record<string, OutcomeVerdicts>;
	/** Overrides by logical identity (highest precedence). */
	identities?: Record<string, OutcomeVerdicts>;
}

/** A scenario result with outcomes and verdicts. */
export interface ClassifiedResult {
	/** Schema version. */
	version: 1;
	/** The raw result. */
	result: ScenarioResult;
	/** Baseline first, then every case. */
	cases: CaseClassification[];
	/** Worst verdict overall. */
	verdict: VerdictLevel;
	/** Oddities in the baseline itself. */
	baselineAnomalies: string[];
	/** Policy used. */
	policy: Policy;
}
