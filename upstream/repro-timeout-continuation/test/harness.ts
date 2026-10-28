// Minimal, dependency-free harness shared (by copy) between the repros so each folder is standalone.
import type { WorkflowFunction, WorkflowResult } from "@rivet-dev/workflows";
import { InMemoryDriver, runWorkflow } from "@rivet-dev/workflows/testing";

/** Set EXPECT_GAP=1 (or run `vitest --mode gap`) to assert today's behavior instead. */
export const EXPECT_GAP = process.env["EXPECT_GAP"] === "1";

export class ProcessCrash extends Error {
	constructor() {
		super("simulated process crash");
		this.name = "ProcessCrash";
	}
}

/**
 * In-memory driver whose writes fail after `crash()`, modelling a process that dies before
 * persisting; `restart()` models a new process reading the same durable state.
 */
export class CrashableDriver extends InMemoryDriver {
	#crashed = false;

	constructor() {
		super();
		this.latency = 0;
	}

	crash(): void {
		this.#crashed = true;
	}

	restart(): void {
		this.#crashed = false;
	}

	get crashed(): boolean {
		return this.#crashed;
	}

	#guard(): void {
		if (this.#crashed) throw new ProcessCrash();
	}

	override async set(key: Uint8Array, value: Uint8Array): Promise<void> {
		this.#guard();
		await super.set(key, value);
	}

	override async batch(writes: { key: Uint8Array; value: Uint8Array }[]): Promise<void> {
		this.#guard();
		await super.batch(writes);
	}

	override async delete(key: Uint8Array): Promise<void> {
		this.#guard();
		await super.delete(key);
	}
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface Settled<T> {
	result: WorkflowResult<T> | undefined;
	error: unknown;
	crashes: number;
}

/** Runs a workflow like a host would: restart after crashes, wait out retry backoff. */
export async function runUntilSettled<T>(
	driver: CrashableDriver,
	wf: WorkflowFunction<undefined, T>,
	maxRuns = 20,
): Promise<Settled<T>> {
	let crashes = 0;
	for (let run = 0; run < maxRuns; run++) {
		try {
			const result = await runWorkflow("wf-1", wf, undefined, driver, { mode: "yield" }).result;
			if (result.state === "sleeping" && result.sleepUntil !== undefined) {
				await sleep(Math.max(0, result.sleepUntil - Date.now()) + 1);
				continue;
			}
			return { result, error: undefined, crashes };
		} catch (error) {
			if (!driver.crashed) return { result: undefined, error, crashes };
			crashes++;
			driver.restart();
		}
	}
	return { result: undefined, error: new Error("maxRuns exceeded"), crashes };
}
