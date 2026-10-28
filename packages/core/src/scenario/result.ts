import type { SerializedError } from "../errors.js";
import type { FaultOutcome, FaultSpec } from "../faults/types.js";
import type { LedgerSnapshot } from "../ledger/types.js";
import type { RunOutcome } from "../runtime/port.js";

/** Where a case came from. */
export type CaseOrigin = "baseline" | "explicit" | "explored";

/** How a case ended. */
export type CaseStatus = "settled" | "budget-exceeded" | "harness-error";

/** Execution record of one case. */
export interface CaseResult {
	/** 0 = baseline. */
	index: number;
	/** Case name. */
	name: string;
	/** Origin of the case. */
	origin: CaseOrigin;
	/** Faults armed. */
	faults: readonly FaultSpec[];
	/** Outcome per fault. */
	faultOutcomes: FaultOutcome[];
	/** How the case ended. */
	status: CaseStatus;
	/** Final run outcome when settled. */
	final: RunOutcome | undefined;
	/** Runs executed. */
	runs: number;
	/** Restarts after crashes. */
	restarts: number;
	/** Case duration in ms (clock time, including grace). */
	durationMs: number;
	/** Finalized ledger. */
	ledger: LedgerSnapshot;
	/** Harness failure, if any. */
	harnessError: SerializedError | undefined;
}

/** An explored candidate that did not fit the budget. */
export interface SkippedCase {
	/** Generated name. */
	name: string;
	/** Faults it would have armed. */
	faults: readonly FaultSpec[];
}

/** Which scenario produced a result. */
export interface ScenarioIdentity {
	/** Scenario name. */
	name: string;
	/** Runtime adapter name. */
	runtime: string;
	/** Workflow ID used for every run. */
	workflowId: string;
	/** Seed. */
	seed: number;
}

/** Result of running a scenario. */
export interface ScenarioResult {
	/** Result schema version. */
	version: 1;
	/** Scenario identification. */
	scenario: ScenarioIdentity;
	/** No-fault baseline. */
	baseline: CaseResult;
	/** Explicit then explored cases. */
	cases: CaseResult[];
	/** Explored candidates over budget. */
	skipped: SkippedCase[];
	/** Whether the baseline completed without faults. */
	baselineClean: boolean;
	/** Clock time at start. */
	startedAt: number;
	/** Total duration in ms. */
	durationMs: number;
}
