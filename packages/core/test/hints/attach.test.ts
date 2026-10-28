import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { attachHints } from "../../src/hints/attach.js";
import type { HintRule } from "../../src/hints/types.js";
import { arbAttempts, arbFinal, caseResult, scenarioResult } from "../classifier/arbitraries.js";

const crash = [{ strategy: "crash" as const, anchor: "after payment#1" }];

describe("attachHints (US2)", () => {
	it("is applied by classify(): duplicated without a key gets add-idempotency-key", () => {
		const classified = classify(
			scenarioResult(caseResult(0, [{}]), [caseResult(1, [{}, {}], { faults: crash })]),
		);
		const [effect] = classified.cases[1]?.effects ?? [];
		expect(effect?.outcome).toBe("duplicated");
		expect(effect?.hints.map((h) => h.id)).toEqual(["add-idempotency-key"]);
		expect(classified.cases[0]?.effects[0]?.hints).toEqual([]);
	});

	it("falls back to investigate when no rule matches", () => {
		const classified = classify(
			scenarioResult(caseResult(0, [{}]), [caseResult(1, [{}, {}], { faults: crash })]),
		);
		const none = attachHints(classified, []);
		expect(none.cases[1]?.effects[0]?.hints.map((h) => h.id)).toEqual(["investigate"]);
	});

	it("gives passing effects no hints, even when a rule would match", () => {
		const always: HintRule = {
			id: "always",
			outcomes: ["exactly-once", "duplicated"],
			matches: () => true,
			render: () => ({ id: "always", title: "t", explanation: "e", example: "x" }),
		};
		const classified = classify(scenarioResult(caseResult(0, [{}]), [caseResult(1, [{}])]));
		expect(attachHints(classified, [always]).cases[1]?.effects[0]?.hints).toEqual([]);
	});

	it("does not mutate its input", () => {
		const classified = classify(
			scenarioResult(caseResult(0, [{}]), [caseResult(1, [{}, {}], { faults: crash })]),
		);
		const before = JSON.stringify(classified);
		attachHints(classified, []);
		expect(JSON.stringify(classified)).toBe(before);
	});

	it("hints warn verdicts too and passes case context to rules", () => {
		const seen: unknown[] = [];
		const spy: HintRule = {
			id: "spy",
			outcomes: ["orphaned"],
			matches: (_e, c) => {
				seen.push(c);
				return true;
			},
			render: () => ({ id: "spy", title: "t", explanation: "e", example: "x" }),
		};
		const result = scenarioResult(caseResult(0, [{}]), [
			caseResult(1, [{}], {
				final: { state: "failed", error: { name: "StepFailedError", message: "x" } },
				faults: [{ strategy: "delay", anchor: "payment#1" }],
			}),
		]);
		const classified = attachHints(classify(result, { default: { orphaned: "warn" } }), [spy]);
		expect(classified.cases[1]?.effects[0]?.hints.map((h) => h.id)).toEqual(["spy"]);
		expect(seen[0]).toMatchObject({
			outcome: "orphaned",
			finalState: "failed",
			faultEvents: [{ strategy: "delay" }],
			faults: [],
		});
	});

	it("every non-passing effect has ≥ 1 hint (invariant)", () => {
		fc.assert(
			fc.property(arbAttempts, arbAttempts, arbFinal, (base, list, final) => {
				const classified = classify(
					scenarioResult(caseResult(0, base), [caseResult(1, list, { final, faults: crash })]),
				);
				for (const c of classified.cases) {
					for (const e of c.effects) {
						if (e.verdict === "pass") expect(e.hints).toEqual([]);
						else expect(e.hints.length).toBeGreaterThanOrEqual(1);
					}
				}
			}),
		);
	});
});
