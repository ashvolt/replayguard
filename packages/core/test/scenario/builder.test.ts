import { describe, expect, expectTypeOf, it } from "vitest";
import { ConfigError } from "../../src/errors.js";
import { fault } from "../../src/faults/types.js";
import { scenario } from "../../src/scenario/builder.js";
import type { EffectContext } from "../../src/scenario/types.js";
import { type FakeWorkflow, fakeRuntime } from "../support/fake-runtime.js";

const configError = (fn: () => unknown) => {
	try {
		fn();
	} catch (error) {
		expect(error).toBeInstanceOf(ConfigError);
		return (error as ConfigError).message;
	}
	throw new Error("expected ConfigError");
};

const base = () =>
	scenario()
		.runtime(fakeRuntime())
		.effects(() => ({ n: 1 }))
		.workflow((): FakeWorkflow => async () => undefined);

describe("scenario builder (US3)", () => {
	it("requires runtime, effects and workflow", () => {
		expect(configError(() => scenario().build())).toContain("runtime is required");
		expect(configError(() => scenario().runtime(fakeRuntime()).build())).toContain(
			"effects factory is required",
		);
		expect(
			configError(() =>
				scenario()
					.runtime(fakeRuntime())
					.effects(() => ({}))
					.build(),
			),
		).toContain("workflow factory is required");
	});

	it("applies defaults", () => {
		const def = base().build().definition;
		expect(def).toMatchObject({
			name: "scenario",
			workflowId: "replayguard-wf",
			seed: 1,
			explore: false,
			budget: { maxRuns: 20, caseTimeoutMs: 10_000, graceMs: 25 },
			cases: [],
			messages: [],
		});
		expect(def.input).toBeUndefined();
	});

	it("rejects duplicate case names, bad budgets, seeds and names", () => {
		expect(configError(() => base().case("a", []).case("a", []).build())).toContain(
			'duplicate case name "a"',
		);
		expect(configError(() => base().budget({ maxRuns: 0 }).build())).toContain("budget.maxRuns");
		expect(configError(() => base().budget({ caseTimeoutMs: 600_001 }).build())).toContain(
			"budget.caseTimeoutMs",
		);
		expect(configError(() => base().seed(1.5).build())).toContain("seed");
		expect(configError(() => base().name("").build())).toContain("name");
		expect(configError(() => base().workflowId("x".repeat(201)).build())).toContain("workflowId");
		expect(configError(() => base().explore({ maxCases: 0 }).build())).toContain(
			"explore.maxCases",
		);
		expect(configError(() => base().case("", []).build())).toContain("case name");
	});

	it("validates fault specs in explicit cases", () => {
		expect(
			configError(() =>
				base()
					.case("bad", [{ strategy: "delay" } as never])
					.build(),
			),
		).toContain("invalid fault spec");
	});

	it("requires a process-isolated runtime for processKill", () => {
		expect(
			configError(() =>
				base()
					.faults([fault.killAfter("p")])
					.build(),
			),
		).toContain("processKill requires a process-isolated runtime");
		expect(
			configError(() =>
				base()
					.explore({ strategies: ["processKill"] })
					.build(),
			),
		).toContain("processKill requires a process-isolated runtime");
		expect(() =>
			scenario()
				.runtime(fakeRuntime({ processIsolated: true }))
				.effects(() => ({}))
				.workflow((): FakeWorkflow => async () => undefined)
				.faults([fault.killAfter("p")])
				.build(),
		).not.toThrow();
	});

	it("names shorthand fault lists and merges explore/budget options", () => {
		const def = base()
			.faults([fault.crashAfter("p")])
			.explore({ maxCases: 3 })
			.budget({ graceMs: 0 })
			.input({ orderId: "o-1" })
			.workflowId("wf-9")
			.seed(42)
			.deliver("approve", 1, 2)
			.build().definition;
		expect(def.cases).toEqual([{ name: "explicit #1", faults: [fault.crashAfter("p")] }]);
		expect(def.explore).toMatchObject({
			maxCases: 3,
			strategies: ["crash", "throwAfter"],
			points: ["after", "before"],
			sample: "first",
		});
		expect(def.budget).toEqual({ maxRuns: 20, caseTimeoutMs: 10_000, graceMs: 0 });
		expect(def.input).toEqual({ orderId: "o-1" });
		expect(def.messages).toEqual([{ name: "approve", body: 1, afterRun: 2 }]);
	});

	it("is immutable: each call returns a new builder", () => {
		const a = base();
		const b = a.name("other");
		expect(a.build().definition.name).toBe("scenario");
		expect(b.build().definition.name).toBe("other");
	});

	it("infers effect and workflow types", () => {
		scenario()
			.runtime(fakeRuntime())
			.effects((ctx) => {
				expectTypeOf(ctx).toEqualTypeOf<EffectContext>();
				return { pay: ctx.instrument(async (amount: number) => amount, { kind: "payment" }) };
			})
			.workflow((effects): FakeWorkflow => {
				expectTypeOf(effects.pay).parameter(0).toEqualTypeOf<number>();
				return async () => undefined;
			});
	});
});
