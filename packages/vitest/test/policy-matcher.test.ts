import { buildReport, classify, manualClock } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import "../src/setup.js";
import { caseOf, clean, duplicatedPayment, resultOf } from "./support/results.js";

const failure = (fn: () => void): string => {
	try {
		fn();
	} catch (error) {
		return (error as Error).message;
	}
	throw new Error("expected the assertion to fail");
};

describe("toPassSideEffectPolicy (US1)", () => {
	it("passes when every effect passes", () => {
		expect(classify(clean())).toPassSideEffectPolicy();
		expect(clean()).toPassSideEffectPolicy();
	});

	it("fails with the case and effect in the message", () => {
		const message = failure(() => expect(classify(duplicatedPayment())).toPassSideEffectPolicy());
		expect(message).toBe(
			[
				"expected side effects to pass the policy, but 1 effect(s) failed:",
				"  • crash after charge › payment.charge o-1: duplicated — payment.charge applied 2× (expected 1). No injected fault explains it: the workflow called the effect more often than in the baseline.",
			].join("\n"),
		);
	});

	it("supports negation", () => {
		expect(duplicatedPayment()).not.toPassSideEffectPolicy();
		expect(failure(() => expect(clean()).not.toPassSideEffectPolicy())).toBe(
			"expected side effects to violate the policy, but every effect passed",
		);
	});

	it("re-classifies with a custom policy", () => {
		const classified = classify(duplicatedPayment());
		expect(classified).toPassSideEffectPolicy({ kinds: { payment: { duplicated: "warn" } } });
		expect(duplicatedPayment()).toPassSideEffectPolicy({
			identities: { "payment.charge::o-1": { duplicated: "pass" } },
		});
	});

	it("checks reports as they are", () => {
		const report = buildReport(classify(duplicatedPayment()), { clock: manualClock(0) });
		expect(report).not.toPassSideEffectPolicy();
	});

	it("fails cases that fail without a failing effect (harness errors)", () => {
		const broken = caseOf(1, "broken harness", []);
		const result = resultOf(caseOf(0, "baseline", []), [
			{
				...broken,
				status: "harness-error",
				final: undefined,
				harnessError: { name: "HarnessError", message: "child exited" },
			},
		]);
		expect(failure(() => expect(result).toPassSideEffectPolicy())).toBe(
			[
				"expected side effects to pass the policy, but 1 case(s) failed:",
				"  • broken harness › case: FAIL — harness error: child exited",
			].join("\n"),
		);
	});

	it("fails clearly for invalid input, even when negated", () => {
		const expected =
			"expected a scenario result (await scenario.run()), a classified result (classify(...)) or a report (buildReport(...)), got number";
		expect(failure(() => expect(42).toPassSideEffectPolicy())).toBe(expected);
		expect(failure(() => expect(42).not.toPassSideEffectPolicy())).toBe(expected);
	});
});
