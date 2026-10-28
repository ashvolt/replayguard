import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { SchemaError } from "../../src/errors.js";
import { manualClock } from "../../src/ports/clock.js";
import { buildReport } from "../../src/report/build.js";
import { parseReport, reportToJson } from "../../src/report/json.js";
import { arbAttempts, arbFinal, caseResult, scenarioResult } from "../classifier/arbitraries.js";
import { checkoutClassified } from "./fixtures.js";

const clock = manualClock(0);

describe("report JSON (US1)", () => {
	it("round-trips a report", () => {
		const report = buildReport(checkoutClassified(), { clock });
		expect(parseReport(reportToJson(report))).toEqual(report);
		expect(reportToJson(report)).toBe(reportToJson(parseReport(reportToJson(report))));
	});

	it("round-trips arbitrary classified results (property)", () => {
		fc.assert(
			fc.property(arbAttempts, arbAttempts, arbFinal, (base, list, final) => {
				const classified = classify(
					scenarioResult(caseResult(0, base), [
						caseResult(1, list, { final, faults: [{ strategy: "delay", anchor: "payment#1" }] }),
					]),
				);
				const report = buildReport(classified, { clock });
				expect(parseReport(reportToJson(report))).toEqual(report);
			}),
		);
	});

	it("rejects other versions with RG_SCHEMA_VERSION", () => {
		const json = reportToJson(buildReport(checkoutClassified(), { clock })).replace(
			'"version": 1',
			'"version": 2',
		);
		const error = (() => {
			try {
				parseReport(json);
			} catch (e) {
				return e;
			}
		})();
		expect(error).toBeInstanceOf(SchemaError);
		expect(error).toMatchObject({
			code: "RG_SCHEMA_VERSION",
			message: "unsupported report version 2; this version of ReplayGuard reads version 1",
		});
	});

	it("rejects malformed JSON and invalid reports", () => {
		expect(() => parseReport("{")).toThrow(
			expect.objectContaining({
				code: "RG_SCHEMA_JSON",
				message: expect.stringMatching(/^report is not valid JSON: /),
			}),
		);
		expect(() => parseReport("null")).toThrow(
			expect.objectContaining({
				code: "RG_SCHEMA_VERSION",
				message: expect.stringContaining("version undefined"),
			}),
		);
		const report = JSON.parse(reportToJson(buildReport(checkoutClassified(), { clock })));
		report.cases[1].effects[0].outcome = "lost";
		expect(() => parseReport(JSON.stringify(report))).toThrow(
			expect.objectContaining({
				code: "RG_SCHEMA_REPORT",
				message: expect.stringMatching(/^invalid report at cases\.1\.effects\.0\.outcome: /),
			}),
		);
		report.cases[1].effects[0].outcome = "duplicated";
		report.extra = true;
		expect(() => parseReport(JSON.stringify(report))).toThrow(/^invalid report/);
	});
});
