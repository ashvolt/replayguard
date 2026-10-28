import { fault, instrument } from "@replayguard/core";
import { runWorkflow, type WorkflowContextInterface } from "@rivet-dev/workflows";
import { InMemoryDriver } from "@rivet-dev/workflows/testing";
import { describe, expect, it } from "vitest";
import { host } from "./support/host.js";

describe("no-fault baseline (US5)", () => {
	it("behaves exactly like an uninstrumented run and records no faults", async () => {
		const plain = async (ctx: WorkflowContextInterface) => {
			const a = await ctx.step("a", async () => 2);
			const b = await ctx.step("b", async () => a * 21);
			return { a, b };
		};
		const driver = new InMemoryDriver();
		driver.latency = 0;
		const expected = await runWorkflow("wf-1", plain, undefined, driver, { mode: "yield" }).result;

		const r = await host(
			(ledger) => {
				const double = instrument(ledger, async () => 2, { kind: "compute" });
				return async (ctx: WorkflowContextInterface) => {
					const a = await ctx.step("a", () => double());
					const b = await ctx.step("b", async () => a * 21);
					return { a, b };
				};
			},
			[fault.none()],
		);
		expect(r.result?.output).toEqual(expected.output);
		expect(r.result?.state).toBe(expected.state);
		expect(r.ledger.faults).toEqual([]);
		expect(r.runs).toBe(1);
	});
});
