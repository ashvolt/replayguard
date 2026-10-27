// Spike: each test states a hypothesis about @rivet-dev/workflows@1.0.0 and asserts
// the behavior we expect if the hypothesis is TRUE. A failing test = hypothesis false.
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { CrashableDriver, FakeWorld, runUntilSettled, sleep } from "./harness.js";

describe("H0 baseline: step throws after side effect (documented at-least-once)", () => {
	it("re-executes the external call on retry", async () => {
		const driver = new CrashableDriver();
		const world = new FakeWorld();
		let n = 0;
		const wf = async (ctx: WorkflowContextInterface) =>
			ctx.step({
				name: "charge",
				retryBackoffBase: 1,
				retryBackoffMax: 1,
				run: async () => {
					await world.effect("payment");
					if (++n === 1) throw new Error("provider response lost");
					return "ok";
				},
			});

		const s = await runUntilSettled(driver, wf);
		expect(s.result?.state).toBe("completed");
		expect(world.applied("payment")).toBe(2);
	});
});

describe("H1: crash after external call, before step result is flushed", () => {
	it("re-executes the step on restart -> duplicate charge", async () => {
		const driver = new CrashableDriver();
		const world = new FakeWorld();
		let crashed = false;
		const wf = async (ctx: WorkflowContextInterface) =>
			ctx.step("charge", async () => {
				await world.effect("payment");
				if (!crashed) {
					crashed = true;
					driver.crash();
				}
				return "ok";
			});

		const s = await runUntilSettled(driver, wf);
		expect(s.crashes).toBe(1);
		expect(s.result?.state).toBe("completed");
		expect(world.applied("payment")).toBe(2);
	});

	it("a provider-side idempotency key turns the duplicate into a dedup", async () => {
		const driver = new CrashableDriver();
		const world = new FakeWorld();
		let crashed = false;
		const wf = async (ctx: WorkflowContextInterface) =>
			ctx.step("charge", async () => {
				await world.effect("payment", { key: `${ctx.workflowId}:charge` });
				if (!crashed) {
					crashed = true;
					driver.crash();
				}
				return "ok";
			});

		await runUntilSettled(driver, wf);
		expect(world.attempted("payment")).toBe(2);
		expect(world.applied("payment")).toBe(1);
	});
});

describe("H2: attempt counter is not persisted before run()", () => {
	it("crash-looping step exceeds maxRetries without StepExhaustedError", async () => {
		const driver = new CrashableDriver();
		const world = new FakeWorld();
		let crashBudget = 5;
		const maxRetries = 2;
		const wf = async (ctx: WorkflowContextInterface) =>
			ctx.step({
				name: "charge",
				maxRetries,
				run: async () => {
					await world.effect("payment");
					if (crashBudget-- > 0) driver.crash();
					return "ok";
				},
			});

		const s = await runUntilSettled(driver, wf);
		expect(s.crashes).toBe(5);
		expect(s.result?.state).toBe("completed");
		// 6 real charges, although maxRetries allows at most 3 attempts.
		expect(world.applied("payment")).toBe(6);
		expect(world.applied("payment")).toBeGreaterThan(maxRetries + 1);
	});
});

describe("H3: step timeout does not cancel the in-flight external call", () => {
	it("retryOnTimeout: original call completes in background -> two charges", async () => {
		const driver = new CrashableDriver();
		const world = new FakeWorld();
		let n = 0;
		const wf = async (ctx: WorkflowContextInterface) =>
			ctx.step({
				name: "charge",
				timeout: 20,
				retryOnTimeout: true,
				maxRetries: 1,
				retryBackoffBase: 1,
				retryBackoffMax: 1,
				run: async () => {
					// First call is slow (provider hangs past timeout), retry is fast.
					await world.effect("payment", { durationMs: ++n === 1 ? 80 : 0 });
					return "ok";
				},
			});

		const s = await runUntilSettled(driver, wf);
		expect(s.result?.state).toBe("completed");
		await sleep(120);
		expect(world.applied("payment")).toBe(2);
	});

	it("default (critical) timeout: workflow fails but the charge still lands", async () => {
		const driver = new CrashableDriver();
		const world = new FakeWorld();
		const wf = async (ctx: WorkflowContextInterface) =>
			ctx.step({
				name: "charge",
				timeout: 20,
				run: async () => {
					await world.effect("payment", { durationMs: 60 });
					return "ok";
				},
			});

		const s = await runUntilSettled(driver, wf);
		expect(s.result?.state).not.toBe("completed");
		await sleep(100);
		expect(world.applied("payment")).toBe(1);
	});
});

describe("H4: ephemeral step results are lost when a later step crashes", () => {
	const build = (ephemeral: boolean) => {
		const driver = new CrashableDriver();
		const world = new FakeWorld();
		let crashed = false;
		const wf = async (ctx: WorkflowContextInterface) => {
			await ctx.step({
				name: "email",
				ephemeral,
				run: async () => {
					await world.effect("email");
				},
			});
			await ctx.step("charge", async () => {
				await world.effect("payment");
				if (!crashed) {
					crashed = true;
					driver.crash();
				}
			});
		};
		return { driver, world, wf };
	};

	it("ephemeral: email re-sent after crash in next step", async () => {
		const { driver, world, wf } = build(true);
		await runUntilSettled(driver, wf);
		expect(world.applied("email")).toBe(2);
	});

	it("control (non-ephemeral): email sent once", async () => {
		const { driver, world, wf } = build(false);
		await runUntilSettled(driver, wf);
		expect(world.applied("email")).toBe(1);
	});
});
