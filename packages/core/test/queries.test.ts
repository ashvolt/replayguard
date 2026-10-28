import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { appliedCount, deduplicatedCount, overlapping } from "../src/ledger/queries.js";
import type { EffectAttempt } from "../src/ledger/types.js";

const attempt = (
	seq: number,
	startedAt: number,
	settledAt: number | undefined,
	status: EffectAttempt["status"] = "applied",
): EffectAttempt => ({
	seq,
	runIndex: 0,
	kind: "k",
	subject: "s",
	identity: "k::s",
	kindOccurrence: seq,
	identityOccurrence: seq,
	idempotencyKey: undefined,
	startedAt,
	settledAt,
	status,
	error: undefined,
	inFlightAtFaults: [],
	preview: undefined,
});

describe("queries", () => {
	it("counts applied and deduplicated per identity", () => {
		const list = [
			attempt(1, 0, 1),
			attempt(2, 1, 2, "deduplicated"),
			attempt(3, 2, 3, "failed"),
			{ ...attempt(4, 0, 1), identity: "x::y" },
		];
		expect(appliedCount(list, "k::s")).toBe(1);
		expect(deduplicatedCount(list, "k::s")).toBe(1);
		expect(appliedCount(list, "x::y")).toBe(1);
	});

	it("finds overlapping intervals with positive length (US3 scenario 3)", () => {
		const list = [
			attempt(1, 0, 80),
			attempt(2, 30, 40),
			attempt(3, 80, 90),
			attempt(4, 100, undefined),
			attempt(5, 200, 201),
		];
		expect(overlapping(list, "k::s").map(([a, b]) => [a.seq, b.seq])).toEqual([
			[1, 2],
			[4, 5],
		]);
	});

	it("overlap is symmetric in input order and ignores zero-length touches", () => {
		fc.assert(
			fc.property(
				fc.array(fc.tuple(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 50 })), {
					maxLength: 8,
				}),
				(spans) => {
					const list = spans.map(([s, d], i) => attempt(i + 1, s, s + d));
					const key = (pairs: [EffectAttempt, EffectAttempt][]) =>
						pairs
							.map(([a, b]) => [Math.min(a.seq, b.seq), Math.max(a.seq, b.seq)].join("-"))
							.sort();
					expect(key(overlapping([...list].reverse(), "k::s"))).toEqual(
						key(overlapping(list, "k::s")),
					);
					for (const [a, b] of overlapping(list, "k::s")) {
						expect(
							Math.min(a.settledAt ?? Infinity, b.settledAt ?? Infinity) -
								Math.max(a.startedAt, b.startedAt),
						).toBeGreaterThan(0);
					}
				},
			),
		);
	});
});
