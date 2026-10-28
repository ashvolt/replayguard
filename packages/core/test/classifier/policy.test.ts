import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { DEFAULT_POLICY, resolveVerdict, validatePolicy } from "../../src/classifier/policy.js";
import { ConfigError } from "../../src/errors.js";
import { caseResult, scenarioResult } from "./arbitraries.js";

describe("policy (US3)", () => {
	it("defaults to strict", () => {
		expect(DEFAULT_POLICY).toEqual({
			"exactly-once": "pass",
			deduplicated: "pass",
			duplicated: "fail",
			"concurrent-duplicate": "fail",
			orphaned: "fail",
			skipped: "fail",
		});
	});

	it("resolves identity > kind (longest prefix) > default > built-in", () => {
		const policy = {
			default: { skipped: "warn" as const },
			kinds: {
				email: { duplicated: "pass" as const },
				"email.send": { duplicated: "warn" as const },
			},
			identities: { "email.send::vip": { duplicated: "fail" as const } },
		};
		expect(resolveVerdict(policy, "email.send", "email.send::vip", "duplicated")).toBe("fail");
		expect(resolveVerdict(policy, "email.send", "email.send::a", "duplicated")).toBe("warn");
		expect(resolveVerdict(policy, "email.digest", "email.digest::a", "duplicated")).toBe("pass");
		expect(resolveVerdict(policy, "emails", "emails::a", "duplicated")).toBe("fail");
		expect(resolveVerdict(policy, "payment", "payment::a", "skipped")).toBe("warn");
		expect(resolveVerdict({}, "payment", "payment::a", "orphaned")).toBe("fail");
	});

	it("duplicate emails can pass while duplicate payments still fail", () => {
		const base = caseResult(0, [{}, { kind: "email", subject: "a" }]);
		const dup = caseResult(1, [
			{},
			{ start: 50 },
			{ kind: "email", subject: "a" },
			{ kind: "email", subject: "a", start: 60 },
		]);
		const result = classify(scenarioResult(base, [dup]), {
			kinds: { email: { duplicated: "pass" } },
		});
		expect(result.cases[1]?.effects.map((e) => [e.kind, e.outcome, e.verdict])).toEqual([
			["payment", "duplicated", "fail"],
			["email", "duplicated", "pass"],
		]);
		const warned = classify(
			scenarioResult(base, [
				caseResult(1, [{ final: undefined } as never], {
					final: { state: "failed", error: { name: "E", message: "m" } },
				}),
			]),
			{
				kinds: { payment: { orphaned: "warn" } },
			},
		);
		expect(warned.cases[1]?.effects[0]).toMatchObject({ outcome: "orphaned", verdict: "warn" });
		expect(warned.policy).toEqual({ kinds: { payment: { orphaned: "warn" } } });
	});

	it("validates policies", () => {
		expect(() => validatePolicy({ kinds: { email: { dupe: "pass" } } })).toThrow(ConfigError);
		expect(() => validatePolicy({ default: { duplicated: "maybe" } })).toThrow(/invalid policy/);
		expect(() =>
			classify(scenarioResult(caseResult(0, []), []), {
				identities: { x: { skipped: "nope" } },
			} as never),
		).toThrow(ConfigError);
		expect(validatePolicy({})).toEqual({});
	});
});
