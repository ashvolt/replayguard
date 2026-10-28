import type { FaultPoint, FaultSpec } from "../faults/types.js";
import type { WorkflowRuntime } from "../runtime/port.js";
import type { EffectContext } from "./effect-context.js";

export type { EffectContext } from "./effect-context.js";

/** Strategies the explorer can generate. */
export type ExploreStrategy = "crash" | "throwAfter" | "delay" | "processKill";

/** Automatic fault exploration options. */
export interface ExploreOptions {
	/** Strategies to generate, in priority order. */
	strategies: ExploreStrategy[];
	/** Points to generate (after-points always run first). */
	points: FaultPoint[];
	/** Maximum explored cases (1–500). */
	maxCases: number;
	/** Hang duration for `delay` (required to generate delay cases). */
	delayMs?: number;
	/** Only explore these effect kinds. */
	kinds?: string[];
	/** `first`: take candidates in priority order; `random`: seeded sample, priority order kept. */
	sample: "first" | "random";
}

/** Default exploration: crash and lost request/response, before and after every effect. */
export const DEFAULT_EXPLORE: ExploreOptions = {
	strategies: ["crash", "throwAfter"],
	points: ["after", "before"],
	maxCases: 50,
	sample: "first",
};

/** Per-case limits. */
export interface Budget {
	/** Maximum runs (restarts + 1) per case (1–1000). */
	maxRuns: number;
	/** Maximum wall time per case in ms (1–600000). */
	caseTimeoutMs: number;
	/** Time to wait after settling so late completions are recorded (0–10000). */
	graceMs: number;
}

/** Default budget. */
export const DEFAULT_BUDGET: Budget = { maxRuns: 20, caseTimeoutMs: 10_000, graceMs: 25 };

/** A named list of faults to apply in one case. */
export interface CaseDefinition {
	/** Case name (unique within the scenario). */
	name: string;
	/** Faults armed together. */
	faults: readonly FaultSpec[];
}

/** A message delivered to a waiting workflow. */
export interface ScriptedMessage {
	/** Message name. */
	name: string;
	/** Message body. */
	body: unknown;
	/** Deliver only once this run index has ended. */
	afterRun?: number;
}

/** Validated, immutable scenario configuration. */
export interface ScenarioDefinition<TEffects = unknown, TWorkflow = unknown, TInput = unknown> {
	/** Scenario name. */
	name: string;
	/** Workflow runtime adapter. */
	runtime: WorkflowRuntime<TWorkflow, TInput>;
	/** Stable workflow ID. */
	workflowId: string;
	/** Builds fresh effects per case. */
	effects: (ctx: EffectContext) => TEffects;
	/** Builds the workflow from the case's effects. */
	workflow: (effects: TEffects) => TWorkflow;
	/** Workflow input. */
	input: TInput | undefined;
	/** Explicit cases. */
	cases: CaseDefinition[];
	/** Exploration options, or `false`. */
	explore: ExploreOptions | false;
	/** Per-case limits. */
	budget: Budget;
	/** Seed for randomized choices. */
	seed: number;
	/** Scripted message deliveries. */
	messages: ScriptedMessage[];
}
