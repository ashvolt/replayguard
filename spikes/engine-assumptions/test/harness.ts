// Spike-only harness. Throwaway code: kept small on purpose, not production quality.
import type { WorkflowFunction, WorkflowResult } from "@rivet-dev/workflows";
import { InMemoryDriver, runWorkflow } from "@rivet-dev/workflows/testing";

export class ProcessCrash extends Error {
	constructor() {
		super("simulated process crash");
		this.name = "ProcessCrash";
	}
}

/**
 * Simulates the host process dying: once `crash()` is called, every persistence
 * write fails, so nothing after that point reaches durable storage. Calling
 * `restart()` models a fresh process reading the same durable KV.
 */
export class CrashableDriver extends InMemoryDriver {
	#crashed = false;
	writes = 0;

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
		this.writes++;
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

export interface EffectCall {
	kind: string;
	key: string | undefined;
	startedAt: number;
	completedAt?: number;
	deduplicated: boolean;
}

/** Fake external world. Records every call; dedups only when a key is supplied. */
export class FakeWorld {
	calls: EffectCall[] = [];
	#seenKeys = new Set<string>();

	async effect(kind: string, opts: { key?: string; durationMs?: number } = {}): Promise<void> {
		const call: EffectCall = {
			kind,
			key: opts.key,
			startedAt: Date.now(),
			deduplicated: opts.key !== undefined && this.#seenKeys.has(opts.key),
		};
		this.calls.push(call);
		if (opts.durationMs) await sleep(opts.durationMs);
		if (opts.key !== undefined) this.#seenKeys.add(opts.key);
		call.completedAt = Date.now();
	}

	/** Calls that reached the provider and produced a real (non-deduplicated) effect. */
	applied(kind: string): number {
		return this.calls.filter((c) => c.kind === kind && c.completedAt && !c.deduplicated).length;
	}

	attempted(kind: string): number {
		return this.calls.filter((c) => c.kind === kind).length;
	}
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Settled<T> {
	result: WorkflowResult<T> | undefined;
	error: unknown;
	runs: number;
	crashes: number;
}

/**
 * Drives a workflow in yield mode until it completes or fails, restarting after
 * simulated crashes and waiting out retry backoff, like a real host would.
 */
export async function runUntilSettled<T>(
	driver: CrashableDriver,
	wf: WorkflowFunction<undefined, T>,
	opts: { maxRuns?: number; id?: string } = {},
): Promise<Settled<T>> {
	const maxRuns = opts.maxRuns ?? 20;
	let crashes = 0;
	for (let runs = 1; runs <= maxRuns; runs++) {
		try {
			const result = await runWorkflow(opts.id ?? "wf-1", wf, undefined, driver, {
				mode: "yield",
			}).result;
			if (result.state === "sleeping" && result.sleepUntil !== undefined) {
				await sleep(Math.max(0, result.sleepUntil - Date.now()) + 1);
				continue;
			}
			return { result, error: undefined, runs, crashes };
		} catch (error) {
			if (driver.crashed) {
				crashes++;
				driver.restart();
				continue;
			}
			return { result: undefined, error, runs, crashes };
		}
	}
	return { result: undefined, error: new Error("maxRuns exceeded"), runs: maxRuns, crashes };
}
