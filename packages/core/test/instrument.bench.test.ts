import { describe, expect, it } from "vitest";
import { instrument } from "../src/instrument/instrument.js";
import { EffectLedger } from "../src/ledger/ledger.js";

describe("overhead (SC-003)", () => {
	it("adds less than 1 ms per instrumented call", async () => {
		const ledger = new EffectLedger();
		ledger.subscribe(() => undefined);
		const fn = instrument(ledger, async (order: { id: string; items: number[] }) => order.id, {
			kind: "payment",
		});
		const order = { id: "o-1", items: Array.from({ length: 50 }, (_, i) => i) };
		const calls = 2_000;
		const start = performance.now();
		for (let i = 0; i < calls; i++) await fn(order);
		const perCall = (performance.now() - start) / calls;
		expect(perCall).toBeLessThan(1);
	});
});
