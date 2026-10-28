import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { caseResult, scenarioResult } from "./arbitraries.js";

describe("classifier performance (T018)", () => {
	it("classifies 100 cases with 20 attempts each in under 100 ms", () => {
		const subjects = ["o-1", "o-2", "o-3", "o-4"];
		const list = Array.from({ length: 20 }, (_, i) => ({
			subject: subjects[i % subjects.length] as string,
			status: "applied" as const,
			start: i * 10,
			end: i * 10 + 5,
		}));
		const baseline = caseResult(0, list.slice(0, 4));
		const cases = Array.from({ length: 100 }, (_, i) => caseResult(i + 1, list));
		const input = scenarioResult(baseline, cases);
		classify(input);
		const start = performance.now();
		const classified = classify(input);
		const elapsed = performance.now() - start;
		expect(classified.cases).toHaveLength(101);
		expect(elapsed).toBeLessThan(100);
	});
});
