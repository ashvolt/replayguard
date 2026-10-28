import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { CrashableDriver, EXPECT_GAP, runUntilSettled, sleep } from "./harness.js";

/** A provider call that honors an AbortSignal, like `fetch(url, { signal })`. */
function provider() {
	const applied: number[] = [];
	let calls = 0;
	return {
		applied,
		async charge(signal: AbortSignal, durationMs: number): Promise<string> {
			const call = ++calls;
			await sleep(durationMs);
			if (signal.aborted) throw new Error("aborted"); // a cancelled request has no effect
			applied.push(call);
			return "ok";
		},
	};
}

/**
 * When a step times out, the engine moves on but nothing tells the running `run()` to stop:
 * `ctx.abortSignal` is not aborted on step timeout, so the timed-out call still lands.
 */
describe("step timeout cancels the timed-out call", () => {
	it("retryOnTimeout: only the retry is applied", async () => {
		const p = provider();
		let attempt = 0;
		const wf = async (ctx: WorkflowContextInterface) =>
			ctx.step({
				name: "charge",
				timeout: 20,
				retryOnTimeout: true,
				maxRetries: 1,
				retryBackoffBase: 1,
				retryBackoffMax: 1,
				run: () => p.charge(ctx.abortSignal, ++attempt === 1 ? 80 : 0),
			});

		const settled = await runUntilSettled(new CrashableDriver(), wf);
		await sleep(150); // let the timed-out call finish if it is still running
		expect(settled.result?.state).toBe("completed");
		if (EXPECT_GAP) {
			// Observed on 1.0.0: both calls applied, including the one that timed out
			// (completion order depends on timer scheduling).
			expect([...p.applied].sort()).toEqual([1, 2]);
		} else {
			expect(p.applied).toEqual([2]);
		}
	});

	it("critical timeout: the failed workflow leaves no applied call behind", async () => {
		const p = provider();
		const wf = async (ctx: WorkflowContextInterface) =>
			ctx.step({ name: "charge", timeout: 20, run: () => p.charge(ctx.abortSignal, 60) });

		const settled = await runUntilSettled(new CrashableDriver(), wf);
		await sleep(120);
		expect(settled.result?.state).not.toBe("completed");
		if (EXPECT_GAP) {
			// Observed on 1.0.0: the workflow failed, yet the charge landed afterwards (orphan).
			expect(p.applied).toEqual([1]);
		} else {
			expect(p.applied).toEqual([]);
		}
	});
});
