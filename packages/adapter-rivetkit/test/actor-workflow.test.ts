import { describe, expect, it } from "vitest";
import { actorWorkflow, isActorWorkflow } from "../src/actor-workflow.js";

describe("actorWorkflow", () => {
	it("wraps a workflow function and actor config", async () => {
		const fn = async () => "done";
		const wf = actorWorkflow(fn, { state: { orderId: "o-1" } });
		expect(wf).toEqual({
			kind: "replayguard.actor-workflow",
			fn,
			config: { state: { orderId: "o-1" } },
		});
		expect(Object.isFrozen(wf)).toBe(true);
		expect(isActorWorkflow(wf)).toBe(true);
	});

	it("defaults to an empty config", () => {
		expect(actorWorkflow(async () => undefined).config).toEqual({});
	});

	it("recognizes only actor workflows", () => {
		for (const value of [undefined, null, 1, {}, { kind: "other" }, async () => undefined]) {
			expect(isActorWorkflow(value)).toBe(false);
		}
	});
});
