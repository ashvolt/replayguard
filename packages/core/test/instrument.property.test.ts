import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { instrument } from "../src/instrument/instrument.js";
import { EffectLedger } from "../src/ledger/ledger.js";

describe("instrument properties", () => {
	it("every call yields exactly one settled attempt whose status matches the outcome", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.array(
					fc.record({
						fail: fc.boolean(),
						dedup: fc.boolean(),
						arg: fc.integer({ min: 0, max: 3 }),
					}),
					{
						maxLength: 25,
					},
				),
				async (calls) => {
					const ledger = new EffectLedger();
					const fn = instrument(
						ledger,
						async (call: { fail: boolean; dedup: boolean; arg: number }) => {
							if (call.fail) throw new Error("x");
							return call.dedup;
						},
						{
							kind: "k",
							subject: (call) => String(call.arg),
							isDeduplicated: (replayed) => replayed,
						},
					);
					for (const call of calls) await fn(call).catch(() => undefined);
					const attempts = ledger.attempts();
					expect(attempts).toHaveLength(calls.length);
					attempts.forEach((attempt, i) => {
						const call = calls[i] as (typeof calls)[number];
						expect(attempt.status).toBe(
							call.fail ? "failed" : call.dedup ? "deduplicated" : "applied",
						);
						expect(attempt.seq).toBe(i + 1);
						expect(attempt.kindOccurrence).toBe(i + 1);
					});
				},
			),
		);
	});
});
