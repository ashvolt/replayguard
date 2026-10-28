import {
	CrashSignal,
	createEffectContext,
	EffectLedger,
	manualClock,
	systemSleeper,
} from "@replayguard/core";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { MemoryDriver } from "../src/memory-driver.js";
import { workflowsRuntime } from "../src/runtime.js";

type Wf = (ctx: WorkflowContextInterface) => Promise<unknown>;

async function prepare(workflow: Wf, options: Parameters<typeof workflowsRuntime>[0] = {}) {
	const ledger = new EffectLedger();
	const rt = workflowsRuntime(options);
	return rt.prepareCase({
		workflowId: "wf-1",
		input: undefined,
		caseIndex: 0,
		ledger,
		effectContext: createEffectContext(ledger, manualClock(), systemSleeper, 0),
		build: () => workflow,
		faults: [],
	});
}

describe("workflowsRuntime", () => {
	it("is in-process and named", () => {
		const rt = workflowsRuntime();
		expect(rt.name).toBe("@rivet-dev/workflows");
		expect(rt.processIsolated).toBe(false);
	});

	it("maps completed and failed results", async () => {
		const ok = await prepare(async (ctx) => ctx.step("a", async () => 42));
		expect(await ok.runOnce(0)).toEqual({ state: "completed", output: 42 });
		const bad = await prepare(async (ctx) =>
			ctx.step({
				name: "a",
				maxRetries: 0,
				run: async () => {
					throw new Error("boom");
				},
			}),
		);
		const outcome = await bad.runOnce(0);
		expect(outcome.state).toBe("failed");
		await bad.dispose();
	});

	it("maps retry backoff to sleeping with a wake time", async () => {
		let n = 0;
		const c = await prepare(async (ctx) =>
			ctx.step({
				name: "a",
				retryBackoffBase: 50,
				retryBackoffMax: 50,
				run: async () => {
					if (n++ === 0) throw new Error("transient");
					return 1;
				},
			}),
		);
		const first = await c.runOnce(0);
		expect(first.state).toBe("sleeping");
		if (first.state !== "sleeping") throw new Error("unreachable");
		expect(first.wakeAt).toBeGreaterThan(Date.now() - 5);
	});

	it("maps crashes (persistence down or CrashSignal) to crashed", async () => {
		const signal = await prepare(async () => {
			throw new CrashSignal("dead");
		});
		expect(await signal.runOnce(0)).toEqual({ state: "crashed" });
		const storage = await prepare(async (ctx) => ctx.step("a", async () => 1));
		storage.persistence.crash();
		expect(await storage.runOnce(0)).toEqual({ state: "crashed" });
	});

	it("waits for messages and delivers them", async () => {
		const c = await prepare(async (ctx) => {
			const msg = await ctx.queue.next<{ ok: boolean }>("approve");
			return msg.body;
		});
		expect(await c.runOnce(0)).toEqual({ state: "waiting", names: expect.any(Array) });
		await c.deliver?.("approve", { ok: true });
		expect(await c.runOnce(1)).toEqual({ state: "completed", output: { ok: true } });
	});

	it("uses a fresh driver per case from the factory", async () => {
		const made: MemoryDriver[] = [];
		const factory = () => {
			const d = new MemoryDriver();
			made.push(d);
			return d;
		};
		await prepare(async () => 1, { createDriver: factory });
		await prepare(async () => 1, { createDriver: factory });
		expect(made).toHaveLength(2);
		expect(made[0]).not.toBe(made[1]);
	});
});
