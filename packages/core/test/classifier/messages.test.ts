import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { buildEvidence } from "../../src/classifier/evidence.js";
import { resolveVerdict, validatePolicy, worstVerdict } from "../../src/classifier/policy.js";
import { ConfigError } from "../../src/errors.js";
import { caseResult, scenarioResult } from "./arbitraries.js";

describe("classifier messages and edges", () => {
	it("names the offending path and reason in policy errors", () => {
		expect(() => validatePolicy({ kinds: { email: { duplicated: "maybe" } } })).toThrow(
			"invalid policy at kinds.email.duplicated: verdict must be pass, warn or fail",
		);
		expect(() => validatePolicy({ default: { lost: "pass" } })).toThrow(
			"invalid policy at default: outcomes must be one of exactly-once, deduplicated, duplicated, concurrent-duplicate, orphaned, skipped",
		);
		expect(() => validatePolicy({ default: { lost: "pass", duplicated: "pass" } })).toThrow(
			ConfigError,
		);
		expect(() => validatePolicy("strict")).toThrow(/^invalid policy: /);
		try {
			validatePolicy({ extra: {} });
		} catch (error) {
			expect((error as ConfigError).code).toBe("RG_CONFIG_POLICY");
		}
	});

	it("ignores kind overrides that do not match and keeps the first worst verdict", () => {
		expect(
			resolveVerdict({ kinds: { sms: { duplicated: "pass" } } }, "email", "email::a", "duplicated"),
		).toBe("fail");
		expect(worstVerdict(["warn", "warn"])).toBe("warn");
		expect(worstVerdict([])).toBe("pass");
	});

	it("derives kind and subject of an expected identity that never appeared", () => {
		const [e] = buildEvidence(caseResult(1, []), new Map([["email::a::b", 1]]));
		expect(e).toMatchObject({ kind: "email", subject: "a::b", expected: 1, attemptSeqs: [] });
	});

	it("reports a settled but waiting baseline and an unknown harness error", () => {
		const waiting = classify(
			scenarioResult(caseResult(0, [{}], { final: { state: "waiting" } as never }), []),
		);
		expect(waiting.baselineAnomalies).toEqual(['baseline did not complete (state "waiting")']);
		const unsettled = classify(
			scenarioResult(caseResult(0, [{}], { status: "budget-exceeded", final: undefined }), []),
		);
		expect(unsettled.baselineAnomalies).toEqual([
			'baseline did not complete (state "budget-exceeded")',
		]);
		const clean = classify(scenarioResult(caseResult(0, [{}]), []));
		expect(clean.baselineAnomalies).toEqual([]);
		const errored = caseResult(1, [{}], { status: "harness-error", final: undefined });
		const { harnessError: _, ...withoutError } = errored;
		const result = classify(
			scenarioResult(caseResult(0, [{}]), [{ ...withoutError, harnessError: undefined }]),
		);
		expect(result.cases[1]?.warnings[0]).toBe("harness error: unknown");
	});
});
