import { runWorkflow, type WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { MemoryDriver } from "../src/memory-driver.js";
import { driverConformance } from "./driver-conformance.js";

const key = (s: string) => new TextEncoder().encode(s);

driverConformance("MemoryDriver", async () => new MemoryDriver());

describe("MemoryDriver", () => {
	it("stores copies so callers cannot mutate persisted bytes", async () => {
		const d = new MemoryDriver();
		const value = key("v1");
		await d.set(key("k"), value);
		value[0] = 0;
		expect(new TextDecoder().decode((await d.get(key("k"))) as Uint8Array)).toBe("v1");
		const batchValue = key("b1");
		await d.batch([{ key: key("b"), value: batchValue }]);
		batchValue[0] = 0;
		expect(new TextDecoder().decode((await d.get(key("b"))) as Uint8Array)).toBe("b1");
	});

	it("tracks alarms, snapshots and clears", async () => {
		const d = new MemoryDriver();
		await d.set(key("a"), key("1"));
		await d.setAlarm("wf", 5);
		await d.setAlarm("later", Date.now() + 60_000);
		expect(d.getAlarm("wf")).toBe(5);
		expect(d.getDueAlarms()).toEqual(["wf"]);
		expect(d.keys()).toEqual(["61"]);
		expect(Object.keys(d.snapshot().kv)).toEqual(["61"]);
		expect(d.snapshot().alarms).toEqual({ wf: 5, later: expect.any(Number) });
		await d.clearAlarm("wf");
		expect(d.getAlarm("wf")).toBeUndefined();
		d.clear();
		expect(d.keys()).toEqual([]);
		expect(d.getAlarm("later")).toBeUndefined();
	});

	it("runs a workflow without per-operation timer latency", async () => {
		const d = new MemoryDriver();
		const start = performance.now();
		for (let i = 0; i < 5; i++) {
			await runWorkflow(
				`wf-${i}`,
				async (ctx: WorkflowContextInterface) => ctx.step("a", async () => i),
				undefined,
				d,
				{
					mode: "yield",
				},
			).result;
			d.clear();
		}
		expect((performance.now() - start) / 5).toBeLessThan(40);
	});
});
