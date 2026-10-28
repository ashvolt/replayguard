import { describe, expect, it } from "vitest";
import { fault } from "../../src/faults/types.js";
import { manualClock } from "../../src/ports/clock.js";
import { scenario } from "../../src/scenario/builder.js";
import { type FakeWorkflow, fakeRuntime, instantSleeper } from "../support/fake-runtime.js";

describe("case isolation (US4)", () => {
	it("calls factories per case and never shares effect state", async () => {
		const created: number[] = [];
		const result = await scenario()
			.runtime(fakeRuntime())
			.effects((ctx) => {
				created.push(ctx.caseIndex);
				const outbox: string[] = [];
				return {
					outbox,
					send: ctx.instrument(async (m: string) => outbox.push(m), { kind: "email" }),
				};
			})
			.workflow(
				({ send, outbox }): FakeWorkflow =>
					async () => {
						await send("hello");
						return { state: "completed", output: outbox.length };
					},
			)
			.case("a", [fault.none()])
			.case("b", [fault.none()])
			.build()
			.run({ sleeper: instantSleeper(manualClock()) });
		expect(created).toEqual([0, 1, 2]);
		expect([result.baseline, ...result.cases].map((c) => c.final)).toEqual([
			{ state: "completed", output: 1 },
			{ state: "completed", output: 1 },
			{ state: "completed", output: 1 },
		]);
		expect(new Set([result.baseline, ...result.cases].map((c) => c.ledger)).size).toBe(3);
	});

	it("exposes ledger, clock, sleeper and case index on the effect context", async () => {
		const clock = manualClock(5);
		const sleeper = instantSleeper(clock);
		let seen: unknown;
		await scenario()
			.runtime(fakeRuntime())
			.effects((ctx) => {
				seen = {
					now: ctx.clock.now(),
					sleeper: ctx.sleeper === sleeper,
					ledger: ctx.ledger.currentRun,
				};
				return {};
			})
			.workflow((): FakeWorkflow => async () => undefined)
			.build()
			.run({ clock, sleeper });
		expect(seen).toEqual({ now: 5, sleeper: true, ledger: 0 });
	});
});
