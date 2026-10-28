import { describe, expect, it } from "vitest";
import { instrument } from "../../src/instrument/instrument.js";
import { EffectLedger } from "../../src/ledger/ledger.js";
import { discoverOccurrences } from "../../src/scenario/discovery.js";

describe("discoverOccurrences (US2)", () => {
	it("lists every attempt's kind occurrence in seq order, optionally filtered by kind", async () => {
		const ledger = new EffectLedger();
		const email = instrument(ledger, async () => 1, { kind: "email" });
		const pay = instrument(ledger, async () => 1, { kind: "payment" });
		const failing = instrument(
			ledger,
			async () => {
				throw new Error("x");
			},
			{ kind: "payment" },
		);
		await email();
		await pay();
		await failing().catch(() => undefined);
		await email();
		const snapshot = ledger.snapshot();
		expect(discoverOccurrences(snapshot)).toEqual([
			{ kind: "email", occurrence: 1 },
			{ kind: "payment", occurrence: 1 },
			{ kind: "payment", occurrence: 2 },
			{ kind: "email", occurrence: 2 },
		]);
		expect(discoverOccurrences(snapshot, ["payment"])).toEqual([
			{ kind: "payment", occurrence: 1 },
			{ kind: "payment", occurrence: 2 },
		]);
	});

	it("orders parallel attempts by start order", async () => {
		const ledger = new EffectLedger();
		const a = instrument(ledger, async () => 1, { kind: "a" });
		const b = instrument(ledger, async () => 1, { kind: "b" });
		await Promise.all([b(), a()]);
		expect(discoverOccurrences(ledger.snapshot()).map((o) => o.kind)).toEqual(["b", "a"]);
	});
});
