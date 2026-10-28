import {
	CrashSignal,
	type RunOutcome,
	serializeError,
	type WorkflowRuntime,
} from "@replayguard/core";
import {
	type EngineDriver,
	runWorkflow,
	type WorkflowFunction,
	type WorkflowResult,
} from "@rivet-dev/workflows";
import { FaultyDriver } from "./faulty-driver.js";
import { MemoryDriver } from "./memory-driver.js";

/** Options for the in-process `@rivet-dev/workflows` runtime. */
export interface WorkflowsRuntimeOptions {
	/** Creates fresh durable storage per case (default: `MemoryDriver`). */
	createDriver?: () => EngineDriver;
}

/** Workflow functions accepted by the engine runtimes. */
export type EngineWorkflow = WorkflowFunction<unknown, unknown>;

/**
 * Maps an engine result to a runtime-neutral `RunOutcome`.
 *
 * @example
 * toOutcome({ state: "completed", output: 1 }); // { state: "completed", output: 1 }
 */
export function toOutcome(result: WorkflowResult<unknown>): RunOutcome {
	// The engine reports a queue wait as "sleeping" with `waitingForMessages` and no wake time.
	if (result.waitingForMessages !== undefined && result.sleepUntil === undefined) {
		return { state: "waiting", names: [...result.waitingForMessages] };
	}
	switch (result.state) {
		case "completed":
			return { state: "completed", output: result.output };
		case "sleeping":
			return { state: "sleeping", wakeAt: result.sleepUntil ?? Date.now() };
		default:
			return {
				state: "failed",
				error: {
					name: "WorkflowNotCompleted",
					message: `workflow ended in state "${result.state}"`,
				},
			};
	}
}

/**
 * Runs the workflow once in yield mode and maps the result (or a crash) to a `RunOutcome`.
 *
 * @example
 * const outcome = await runEngineOnce("wf", workflow, undefined, driver, () => driver.crashed);
 */
export async function runEngineOnce(
	workflowId: string,
	workflow: EngineWorkflow,
	input: unknown,
	driver: EngineDriver,
	crashed: () => boolean,
): Promise<RunOutcome> {
	try {
		const result = await runWorkflow(workflowId, workflow, input, driver, { mode: "yield" }).result;
		return toOutcome(result);
	} catch (error) {
		if (crashed() || error instanceof CrashSignal) return { state: "crashed" };
		return { state: "failed", error: serializeError(error) };
	}
}

/**
 * Runs `@rivet-dev/workflows` workflows in-process: one fresh durable store per case, wrapped in
 * `FaultyDriver`, driven in yield mode like a host process.
 *
 * @example
 * scenario().runtime(workflowsRuntime()).effects(fx).workflow(() => myWorkflow);
 */
export function workflowsRuntime(
	options: WorkflowsRuntimeOptions = {},
): WorkflowRuntime<EngineWorkflow> {
	return {
		name: "@rivet-dev/workflows",
		processIsolated: false,
		async prepareCase(input) {
			const driver = new FaultyDriver(options.createDriver?.() ?? new MemoryDriver());
			const workflow = input.build(input.effectContext);
			return {
				persistence: driver,
				runOnce: () =>
					runEngineOnce(input.workflowId, workflow, input.input, driver, () => driver.crashed),
				async deliver(name, body) {
					await driver.messageDriver.addMessage({
						id: crypto.randomUUID(),
						name,
						data: body,
						sentAt: Date.now(),
					});
				},
				async dispose() {},
			};
		},
	};
}
