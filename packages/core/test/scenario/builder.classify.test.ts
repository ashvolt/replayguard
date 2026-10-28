import { describe, expect, it } from "vitest";
import { ConfigError } from "../../src/errors.js";
import { fault } from "../../src/faults/types.js";
import { manualClock } from "../../src/ports/clock.js";
import { scenario } from "../../src/scenario/builder.js";
import { type FakeWorkflow, fakeRuntime, instantSleeper } from "../support/fake-runtime.js";

function checkout() {
	return scenario()
		.name("checkout")
		.runtime(fakeRuntime())
		.effects((ctx) => ({ charge: ctx.instrument(async () => "ok", { kind: "payment" }) }))
		.workflow(
			({ charge }): FakeWorkflow =>
				async () => {
					await charge();
					return undefined;
				},
		)
		.case("crash after charge", [fault.crashAfter("payment")])
		.build();
}

function deterministic() {
	const clock = manualClock(1_000);
	return { clock, sleeper: instantSleeper(clock) };
}

describe("run({ classify: true }) (T020)", () => {
	it("returns a classified result", async () => {
		const classified = await checkout().run({ ...deterministic(), classify: true });
		expect(classified.version).toBe(1);
		expect(classified.result.cases).toHaveLength(1);
		expect(classified.cases.map((c) => c.effects[0]?.outcome)).toEqual([
			"exactly-once",
			"duplicated",
		]);
		expect(classified.verdict).toBe("fail");
	});

	it("applies the policy", async () => {
		const classified = await checkout().run({
			...deterministic(),
			classify: true,
			policy: { kinds: { payment: { duplicated: "warn" } } },
		});
		expect(classified.verdict).toBe("warn");
		expect(classified.policy).toEqual({ kinds: { payment: { duplicated: "warn" } } });
	});

	it("rejects an invalid policy before running", async () => {
		await expect(
			checkout().run({
				...deterministic(),
				classify: true,
				policy: { kinds: { payment: { lost: "pass" } } } as never,
			}),
		).rejects.toThrow(ConfigError);
	});

	it("returns the raw result without classify", async () => {
		const result = await checkout().run(deterministic());
		expect(result).not.toHaveProperty("verdict");
		expect(result.cases).toHaveLength(1);
	});
});
