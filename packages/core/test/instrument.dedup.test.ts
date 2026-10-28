import { describe, expect, it } from "vitest";
import { instrument } from "../src/instrument/instrument.js";
import { EffectLedger } from "../src/ledger/ledger.js";
import { appliedCount, deduplicatedCount } from "../src/ledger/queries.js";

describe("provider-side deduplication (US2)", () => {
	function provider() {
		const seen = new Set<string>();
		return async (orderId: string, key: string | undefined) => {
			const replayed = key !== undefined && seen.has(key);
			if (key !== undefined) seen.add(key);
			return { orderId, replayed };
		};
	}

	it("marks replays reported by the provider as deduplicated with their key", async () => {
		const ledger = new EffectLedger();
		const charge = instrument(ledger, provider(), {
			kind: "payment",
			subject: (orderId) => orderId,
			idempotencyKey: (_orderId, key) => key,
			isDeduplicated: (result) => result.replayed,
		});
		await charge("o-1", "wf:charge");
		await charge("o-1", "wf:charge");
		expect(ledger.attempts().map((a) => [a.status, a.idempotencyKey])).toEqual([
			["applied", "wf:charge"],
			["deduplicated", "wf:charge"],
		]);
		expect(appliedCount(ledger.attempts(), "payment::o-1")).toBe(1);
		expect(deduplicatedCount(ledger.attempts(), "payment::o-1")).toBe(1);
	});

	it("without a key both attempts are applied", async () => {
		const ledger = new EffectLedger();
		const charge = instrument(ledger, provider(), {
			kind: "payment",
			subject: (orderId) => orderId,
			isDeduplicated: (result) => result.replayed,
		});
		await charge("o-1", undefined);
		await charge("o-1", undefined);
		expect(appliedCount(ledger.attempts(), "payment::o-1")).toBe(2);
		expect(deduplicatedCount(ledger.attempts(), "payment::o-1")).toBe(0);
	});
});
