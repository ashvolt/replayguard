import { CrashSignal, serializeError } from "../../src/errors.js";
import type { ManualClock } from "../../src/ports/clock.js";
import type { Sleeper } from "../../src/ports/sleeper.js";
import type { RunOutcome, RuntimeCase, WorkflowRuntime } from "../../src/runtime/port.js";
import { FakePersistence } from "./fake-persistence.js";

/** Workflow shape understood by the fake runtime. */
export type FakeWorkflow = (run: {
	runIndex: number;
	delivered: string[];
}) => Promise<RunOutcome | undefined>;

/**
 * In-memory WorkflowRuntime for runner unit tests. A workflow returns a RunOutcome (or undefined
 * for "completed"); a thrown CrashSignal maps to "crashed", any other throw to "failed".
 */
export function fakeRuntime(
	options: { processIsolated?: boolean; failPrepare?: (caseIndex: number) => boolean } = {},
): WorkflowRuntime<FakeWorkflow> & { prepared: number; delivered: string[][] } {
	const runtime = {
		name: "fake",
		processIsolated: options.processIsolated ?? false,
		prepared: 0,
		delivered: [] as string[][],
		async prepareCase(
			input: Parameters<WorkflowRuntime<FakeWorkflow>["prepareCase"]>[0],
		): Promise<RuntimeCase> {
			if (options.failPrepare?.(input.caseIndex))
				throw new Error(`cannot prepare case ${input.caseIndex}`);
			runtime.prepared++;
			const workflow = input.build(input.effectContext);
			const persistence = new FakePersistence();
			const delivered: string[] = [];
			runtime.delivered.push(delivered);
			return {
				persistence,
				async runOnce(runIndex) {
					try {
						return (
							(await workflow({ runIndex, delivered })) ?? { state: "completed", output: runIndex }
						);
					} catch (error) {
						if (error instanceof CrashSignal || persistence.crashed) return { state: "crashed" };
						return { state: "failed", error: serializeError(error) };
					}
				},
				async deliver(name) {
					delivered.push(name);
				},
				async dispose() {},
			};
		},
	};
	return runtime;
}

/** Sleeper that advances a manual clock instantly and records requested durations. */
export function instantSleeper(clock: ManualClock): Sleeper & { slept: number[] } {
	const slept: number[] = [];
	return {
		slept,
		async sleep(ms) {
			slept.push(ms);
			clock.advance(Math.max(0, ms));
		},
	};
}
