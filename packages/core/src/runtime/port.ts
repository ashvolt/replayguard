import type { SerializedError } from "../errors.js";
import type { FaultStrategy } from "../faults/strategy.js";
import type { FaultSpec } from "../faults/types.js";
import type { EffectLedger } from "../ledger/ledger.js";
import type { PersistenceControl } from "../ports/persistence.js";
import type { EffectContext } from "../scenario/effect-context.js";

/** The workflow finished. */
export interface CompletedOutcome {
	/** Discriminator. */
	state: "completed";
	/** Workflow output. */
	output: unknown;
}

/** The workflow failed terminally (e.g. retries exhausted, critical timeout). */
export interface FailedOutcome {
	/** Discriminator. */
	state: "failed";
	/** Serialized failure. */
	error: SerializedError;
}

/** The simulated process died; the host restarts from durable state. */
export interface CrashedOutcome {
	/** Discriminator. */
	state: "crashed";
}

/** The workflow yielded until a retry or sleep deadline. */
export interface SleepingOutcome {
	/** Discriminator. */
	state: "sleeping";
	/** Clock time to resume at. */
	wakeAt: number;
}

/** The workflow waits for messages. */
export interface WaitingOutcome {
	/** Discriminator. */
	state: "waiting";
	/** Message names it waits for. */
	names: string[];
}

/** Result of running a workflow once (one simulated process lifetime). */
export type RunOutcome =
	| CompletedOutcome
	| FailedOutcome
	| CrashedOutcome
	| SleepingOutcome
	| WaitingOutcome;

/** One prepared case: durable storage plus the ability to (re)run the workflow on it. */
export interface RuntimeCase {
	/** Durable storage control used by fault strategies and restarts. */
	readonly persistence: PersistenceControl;
	/** Runs the workflow once from durable state. Must not throw for workflow failures. */
	runOnce(runIndex: number): Promise<RunOutcome>;
	/** Delivers a message to a waiting workflow (optional). */
	deliver?(name: string, body: unknown): Promise<void>;
	/** Releases resources (processes, temp directories). */
	dispose(): Promise<void>;
}

/** Everything a runtime needs to prepare a case. */
export interface PrepareCaseInput<TWorkflow, TInput> {
	/** Stable workflow ID for every run of the case. */
	workflowId: string;
	/** Workflow input. */
	input: TInput | undefined;
	/** 0 = baseline, then explicit and explored cases. */
	caseIndex: number;
	/** The case's ledger. */
	ledger: EffectLedger;
	/** Effect context bound to the ledger (in-process runtimes pass it to `build`). */
	effectContext: EffectContext;
	/** Builds the workflow from an effect context. */
	build: (ctx: EffectContext) => TWorkflow;
	/** Faults armed for the case. */
	faults: readonly FaultSpec[];
}

/**
 * Port for workflow runtimes (Ports & Adapters): the runner never imports Rivet directly.
 *
 * @example
 * scenario().runtime(workflowsRuntime());
 */
export interface WorkflowRuntime<TWorkflow = unknown, TInput = unknown> {
	/** Runtime name shown in results. */
	readonly name: string;
	/** Whether each run executes in its own OS process. */
	readonly processIsolated: boolean;
	/** Fault strategies this runtime supports (default: in-process strategies). */
	readonly strategies?: readonly FaultStrategy[];
	/** Creates fresh durable storage and a runnable case. */
	prepareCase(input: PrepareCaseInput<TWorkflow, TInput>): Promise<RuntimeCase>;
}
