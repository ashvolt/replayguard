import { describe, expect, it } from "vitest";
import { instrument } from "../src/instrument/instrument.js";
import { EffectLedger } from "../src/ledger/ledger.js";

async function perCallMs(calls: number): Promise<number> {
	const ledger = new EffectLedger();
	ledger.subscribe(() => undefined);
	const fn = instrument(ledger, async (order: { id: string; items: number[] }) => order.id, {
		kind: "payment",
	});
	const order = { id: "o-1", items: Array.from({ length: 50 }, (_, i) => i) };
	const start = performance.now();
	for (let i = 0; i < calls; i++) await fn(order);
	return (performance.now() - start) / calls;
}

describe("overhead (SC-003)", () => {
	it("adds less than 1 ms per instrumented call", async () => {
		await perCallMs(200); // warm-up (JIT)
		// Best of several batches: robust to CPU contention from parallel test workers.
		const samples: number[] = [];
		for (let batch = 0; batch < 5; batch++) samples.push(await perCallMs(500));
		expect(Math.min(...samples)).toBeLessThan(1);
	});
});
