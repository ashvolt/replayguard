import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { caseResult, scenarioResult } from "./arbitraries.js";

describe("verdict aggregation (US2)", () => {
	it("fails the case and scenario on a duplicated effect, listing it", () => {
		const result = classify(
			scenarioResult(caseResult(0, [{}]), [caseResult(1, [{}, { start: 50 }])]),
		);
		expect(result.cases[0]?.verdict).toBe("pass");
		expect(result.cases[1]?.verdict).toBe("fail");
		expect(result.cases[1]?.effects[0]).toMatchObject({ outcome: "duplicated", verdict: "fail" });
		expect(result.verdict).toBe("fail");
	});

	it("passes exactly-once and deduplicated", () => {
		const result = classify(
			scenarioResult(caseResult(0, [{}]), [
				caseResult(1, [{}]),
				caseResult(2, [{ key: "k" }, { key: "k", status: "deduplicated", start: 9 }]),
			]),
		);
		expect(result.verdict).toBe("pass");
		expect(result.cases.map((c) => c.verdict)).toEqual(["pass", "pass", "pass"]);
	});

	it("fails harness errors and warns on exceeded budgets", () => {
		const result = classify(
			scenarioResult(caseResult(0, [{}]), [
				caseResult(1, [], { status: "harness-error", final: undefined }),
				caseResult(2, [{}], { status: "budget-exceeded", final: undefined }),
			]),
		);
		expect(result.cases[1]).toMatchObject({ verdict: "fail", warnings: ["harness error: boom"] });
		expect(result.cases[2]?.verdict).toBe("warn");
		expect(result.cases[2]?.warnings).toContain(
			"case exceeded its budget; the workflow never settled",
		);
		expect(result.verdict).toBe("fail");
	});

	it("a warn-only scenario does not fail", () => {
		const result = classify(
			scenarioResult(caseResult(0, [{}]), [
				caseResult(1, [{}], { status: "budget-exceeded", final: undefined }),
			]),
		);
		expect(result.verdict).toBe("warn");
	});
});
