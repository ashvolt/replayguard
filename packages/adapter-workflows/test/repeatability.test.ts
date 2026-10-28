import { describe, expect, it } from "vitest";
import { checkout } from "./scenario.e2e.test.js";

describe("repeatability (US4, SC-003)", () => {
	it("identical seed → identical case order, statuses and effect counts across runs", {
		timeout: 60_000,
	}, async () => {
		const fingerprint = async () => {
			const r = await checkout().explore().seed(3).build().run();
			return [r.baseline, ...r.cases].map((c) => [
				c.name,
				c.status,
				c.restarts,
				c.ledger.attempts.map((a) => `${a.kind}:${a.status}`).join(","),
			]);
		};
		const first = await fingerprint();
		for (let i = 0; i < 20; i++) expect(await fingerprint()).toEqual(first);
	});
});
