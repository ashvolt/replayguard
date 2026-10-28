import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { arbAttempts, arbFinal, caseResult, scenarioResult } from "./arbitraries.js";

describe("classifier invariants (FR-010, SC-002)", () => {
	it("never calls an effect applied more than expected (without dedup) exactly-once or deduplicated", () => {
		fc.assert(
			fc.property(arbAttempts, arbAttempts, arbFinal, (baseAttempts, caseAttempts, final) => {
				const result = classify(
					scenarioResult(caseResult(0, baseAttempts), [caseResult(1, caseAttempts, { final })]),
				);
				const expected = new Map<string, number>();
				for (const a of result.result.baseline.ledger.attempts) {
					if (a.status === "applied" || a.status === "deduplicated")
						expected.set(a.identity, (expected.get(a.identity) ?? 0) + 1);
				}
				for (const effect of result.cases[1]?.effects ?? []) {
					if (effect.evidence.applied > Math.max(effect.evidence.expected, 1)) {
						expect(["exactly-once", "deduplicated"]).not.toContain(effect.outcome);
					}
					expect(effect.evidence.expected).toBe(expected.get(effect.identity) ?? 0);
				}
			}),
			{ numRuns: 2_000 },
		);
	});

	it("classifies each applied or deduplicated identity exactly once", () => {
		fc.assert(
			fc.property(arbAttempts, arbFinal, (caseAttempts, final) => {
				const result = classify(
					scenarioResult(caseResult(0, []), [caseResult(1, caseAttempts, { final })]),
				);
				const identities = new Set(
					result.result.cases[0]?.ledger.attempts
						.filter((a) => a.status === "applied" || a.status === "deduplicated")
						.map((a) => a.identity),
				);
				const classified = result.cases[1]?.effects.map((e) => e.identity) ?? [];
				expect(new Set(classified).size).toBe(classified.length);
				expect(new Set(classified)).toEqual(identities);
			}),
			{ numRuns: 2_000 },
		);
	});
});
