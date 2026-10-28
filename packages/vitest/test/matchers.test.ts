import { describe, expect, it } from "vitest";
import "../src/setup.js";
import { replayGuardMatchers } from "../src/matchers.js";
import {
	clean,
	dedupedPaymentDuplicatedEmail,
	duplicatedPayment,
	orphanedPayment,
} from "./support/results.js";

const failure = (fn: () => void): string => {
	try {
		fn();
	} catch (error) {
		return (error as Error).message;
	}
	throw new Error("expected the assertion to fail");
};

describe("targeted matchers (US2)", () => {
	it("exports every matcher", () => {
		expect(Object.keys(replayGuardMatchers).sort()).toEqual([
			"toBeEffectivelyOnce",
			"toHaveNoDuplicateEffects",
			"toHaveNoOrphanedEffects",
			"toHaveOutcome",
			"toPassSideEffectPolicy",
		]);
	});

	it("toHaveNoDuplicateEffects", () => {
		expect(clean()).toHaveNoDuplicateEffects();
		expect(
			failure(() => expect(dedupedPaymentDuplicatedEmail()).toHaveNoDuplicateEffects()),
		).toMatch(
			/^expected no duplicated effects, but found 1:\n {2}• lost response › email\.send a@example\.com: duplicated — /,
		);
		expect(duplicatedPayment()).not.toHaveNoDuplicateEffects();
		expect(failure(() => expect(clean()).not.toHaveNoDuplicateEffects())).toBe(
			"expected duplicated effects, but found none",
		);
	});

	it("toHaveNoOrphanedEffects", () => {
		expect(duplicatedPayment()).toHaveNoOrphanedEffects();
		expect(failure(() => expect(orphanedPayment()).toHaveNoOrphanedEffects())).toMatch(
			/^expected no orphaned effects, but found 1:\n {2}• slow provider › payment\.charge o-1: orphaned — /,
		);
		expect(orphanedPayment()).not.toHaveNoOrphanedEffects();
		expect(failure(() => expect(clean()).not.toHaveNoOrphanedEffects())).toBe(
			"expected orphaned effects, but found none",
		);
	});

	it("toBeEffectivelyOnce accepts exactly-once and deduplicated", () => {
		expect(dedupedPaymentDuplicatedEmail()).toBeEffectivelyOnce("payment");
		expect(clean()).toBeEffectivelyOnce((e) => e.kind === "email.send");
		expect(
			failure(() => expect(dedupedPaymentDuplicatedEmail()).toBeEffectivelyOnce("email")),
		).toMatch(
			/^expected "email" to be effectively once, but 1 effect\(s\) were not:\n {2}• lost response › email\.send/,
		);
		expect(failure(() => expect(clean()).toBeEffectivelyOnce("sms"))).toBe(
			'expected "sms" to be effectively once, but no effect matched it',
		);
		expect(dedupedPaymentDuplicatedEmail()).not.toBeEffectivelyOnce("email");
		expect(failure(() => expect(clean()).not.toBeEffectivelyOnce("payment"))).toBe(
			'expected "payment" not to be effectively once, but every matching effect was exactly-once or deduplicated',
		);
	});

	it("toHaveOutcome", () => {
		expect(duplicatedPayment()).toHaveOutcome("payment", "duplicated");
		expect(dedupedPaymentDuplicatedEmail()).toHaveOutcome("payment.charge::o-1", "deduplicated");
		expect(failure(() => expect(clean()).toHaveOutcome("payment", "duplicated"))).toBe(
			[
				'expected an effect matching "payment" to be duplicated, but found:',
				"  • baseline › payment.charge o-1: exactly-once — payment.charge applied once.",
				"  • crash before charge › payment.charge o-1: exactly-once — payment.charge applied once.",
			].join("\n"),
		);
		expect(failure(() => expect(clean()).toHaveOutcome("sms", "duplicated"))).toBe(
			'expected an effect matching "sms" to be duplicated, but no effect matched it',
		);
		expect(clean()).not.toHaveOutcome("payment", "duplicated");
		expect(
			failure(() => expect(duplicatedPayment()).not.toHaveOutcome("payment", "duplicated")),
		).toMatch(/^expected no effect matching "payment" to be duplicated, but found 1:\n/);
	});
});
