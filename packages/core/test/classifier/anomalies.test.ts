import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { caseResult, scenarioResult } from "./arbitraries.js";

describe("anomalies and warnings", () => {
	it("reports baseline anomalies without failing on them", () => {
		const base = caseResult(
			0,
			[
				{ start: 0, end: 50 },
				{ start: 10, end: 20 },
				{ kind: "email", status: "deduplicated" },
			],
			{
				final: { state: "failed", error: { name: "E", message: "boom" } },
			},
		);
		const result = classify(scenarioResult(base, []));
		expect(result.baselineAnomalies).toEqual([
			'baseline did not complete (state "failed")',
			"baseline has overlapping calls for payment::o-1",
			"baseline deduplicated email::o-1 without any fault",
		]);
	});

	it("warns about attempts still in flight and effects never applied", () => {
		const result = classify(
			scenarioResult(caseResult(0, [{}]), [
				caseResult(
					1,
					[{}, { kind: "email", status: "started", start: 5 }, { kind: "sms", status: "failed" }],
					{
						final: { state: "failed", error: { name: "E", message: "m" } },
					},
				),
			]),
		);
		expect(result.cases[1]?.warnings).toEqual([
			"attempt #2 (email::o-1) was still in flight when the case ended",
			"sms::o-1 was attempted but never applied (workflow failed)",
		]);
	});

	it("names the unsettled state for never-applied effects in unsettled cases", () => {
		const result = classify(
			scenarioResult(caseResult(0, []), [
				caseResult(1, [{ status: "failed" }], { status: "budget-exceeded", final: undefined }),
			]),
		);
		expect(result.cases[1]?.warnings).toContain(
			"payment::o-1 was attempted but never applied (workflow unsettled)",
		);
	});
});
