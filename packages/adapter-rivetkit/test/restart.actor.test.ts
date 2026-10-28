import { describe, expect, it } from "vitest";
import * as fixture from "./fixtures/conformance.actor.mjs";
import { ACTOR_SKIP_REASON } from "./support/actor-env.js";

// Spec 012 T010: kill the actor host at an anchor; the actor resumes on a new host.
describe.skipIf(ACTOR_SKIP_REASON !== undefined)("actor crash, restart and sleep (US2)", () => {
	it("resumes after a real host kill and re-executes the charge", async () => {
		const classified = await fixture.killAfterCharge().run({ classify: true });
		const [kill] = classified.result.cases;
		expect(kill).toMatchObject({
			status: "settled",
			restarts: 1,
			final: { state: "completed", output: "done" },
		});
		expect(kill?.faultOutcomes[0]).toMatchObject({ strategy: "processKill", triggered: true });
		expect(classified.cases[1]?.effects.map((e) => [e.kind, e.outcome])).toEqual([
			["payment", "duplicated"],
			["email", "exactly-once"],
		]);
	}, 240_000);

	it("sleeps durably and is woken by the engine", async () => {
		const result = await fixture.sleepThenCharge().run();
		expect(result.baseline).toMatchObject({
			status: "settled",
			final: { state: "completed", output: "woke" },
		});
		expect(result.baseline.ledger.attempts.map((a) => a.status)).toEqual(["applied"]);
	}, 240_000);
});
