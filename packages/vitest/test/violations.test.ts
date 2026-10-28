import type { EffectReport } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { normalize } from "../src/normalize.js";
import {
	collectViolations,
	describeSelector,
	formatViolations,
	selects,
	type Violation,
} from "../src/violations.js";
import { dedupedPaymentDuplicatedEmail } from "./support/results.js";

const effect = (kind: string, subject = "s"): EffectReport => ({
	identity: `${kind}::${subject}`,
	kind,
	subject,
	outcome: "exactly-once",
	verdict: "pass",
	applied: 1,
	deduplicated: 0,
	failed: 0,
	expected: 1,
	explanation: "",
	hints: [],
});

describe("selectors (T004)", () => {
	it("match by exact kind, dotted or colon prefix, identity or predicate", () => {
		expect(selects("payment", effect("payment"))).toBe(true);
		expect(selects("payment", effect("payment.charge"))).toBe(true);
		expect(selects("http", effect("http:POST /orders"))).toBe(true);
		expect(selects("payment.charge::o-1", effect("payment.charge", "o-1"))).toBe(true);
		expect(selects("pay", effect("payment"))).toBe(false);
		expect(selects("payment.charge", effect("payment"))).toBe(false);
		expect(selects((e) => e.subject === "s", effect("x"))).toBe(true);
	});

	it("describe themselves", () => {
		expect(describeSelector("payment")).toBe('"payment"');
		expect(
			describeSelector(function isPayment() {
				return true;
			}),
		).toBe("isPayment");
		expect(describeSelector(() => true)).toBe("predicate");
	});
});

describe("violations", () => {
	it("collects matching effects with their case", () => {
		const { report } = normalize(dedupedPaymentDuplicatedEmail());
		expect(collectViolations(report, (e) => e.outcome === "duplicated")).toEqual([
			{
				caseName: "lost response",
				identity: "email.send::a@example.com",
				kind: "email.send",
				subject: "a@example.com",
				outcome: "duplicated",
				verdict: "fail",
				explanation: expect.stringContaining("email.send applied 2× (expected 1)."),
			},
		]);
	});

	it("formats up to 20 violations and counts the rest", () => {
		const v = (i: number): Violation => ({
			caseName: `case ${i}`,
			identity: `payment::o-${i}`,
			kind: "payment",
			subject: `o-${i}`,
			outcome: "duplicated",
			verdict: "fail",
			explanation: "applied 2×.",
		});
		expect(formatViolations("header:", [v(1)])).toBe(
			"header:\n  • case 1 › payment o-1: duplicated — applied 2×.",
		);
		const many = formatViolations(
			"header:",
			Array.from({ length: 23 }, (_, i) => v(i + 1)),
		).split("\n");
		expect(many).toHaveLength(22);
		expect(many[20]).toBe("  • case 20 › payment o-20: duplicated — applied 2×.");
		expect(many[21]).toBe("  …and 3 more");
		expect(formatViolations("header", [])).toBe("header");
	});
});
