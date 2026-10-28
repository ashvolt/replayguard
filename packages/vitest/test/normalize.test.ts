import { buildReport, classify, manualClock } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { normalize } from "../src/normalize.js";
import { duplicatedPayment } from "./support/results.js";

describe("normalize (T002)", () => {
	it("classifies a raw scenario result with the strict policy", () => {
		const { report, classified } = normalize(duplicatedPayment());
		expect(report.summary.verdict).toBe("fail");
		expect(classified?.verdict).toBe("fail");
	});

	it("classifies a raw scenario result with a given policy", () => {
		const { report } = normalize(duplicatedPayment(), {
			kinds: { payment: { duplicated: "pass" } },
		});
		expect(report.summary.verdict).toBe("pass");
	});

	it("reports a classified result, re-classifying only when a policy is given", () => {
		const classified = classify(duplicatedPayment());
		expect(normalize(classified).classified).toBe(classified);
		expect(normalize(classified).report.summary.verdict).toBe("fail");
		const relaxed = normalize(classified, { kinds: { payment: { duplicated: "warn" } } });
		expect(relaxed.report.summary.verdict).toBe("warn");
	});

	it("passes a report through", () => {
		const report = buildReport(classify(duplicatedPayment()), { clock: manualClock(0) });
		expect(normalize(report)).toEqual({ report, classified: undefined });
	});

	it("refuses to apply a policy to a report", () => {
		const report = buildReport(classify(duplicatedPayment()), { clock: manualClock(0) });
		expect(() => normalize(report, {})).toThrow(
			"a policy can only be applied to a scenario result or classified result, not to a report",
		);
	});

	it("explains what it expected for anything else", () => {
		for (const value of [undefined, null, 42, "x", {}, { version: 2 }]) {
			expect(() => normalize(value)).toThrow(
				/^expected a scenario result \(await scenario\.run\(\)\), a classified result \(classify\(\.\.\.\)\) or a report \(buildReport\(\.\.\.\)\), got /,
			);
		}
		expect(() => normalize(null)).toThrow(/got null$/);
		expect(() => normalize([])).toThrow(/got array$/);
		expect(() => normalize({ version: 2 })).toThrow(/got object$/);
	});
});
