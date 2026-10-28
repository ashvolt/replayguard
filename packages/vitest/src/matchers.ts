import type { Outcome, Policy, Report } from "@replayguard/core";
import { normalize } from "./normalize.js";
import {
	collectViolations,
	describeSelector,
	type EffectSelector,
	formatViolations,
	selects,
	type Violation,
} from "./violations.js";

/** Matchers added to `expect` by `@replayguard/vitest/setup`. */
export interface ReplayGuardMatchers<R = unknown> {
	/** No effect (or case) has verdict `fail`; re-classifies with `policy` when given. */
	toPassSideEffectPolicy(policy?: Policy): R;
	/** No effect is `duplicated` or `concurrent-duplicate`. */
	toHaveNoDuplicateEffects(): R;
	/** No effect is `orphaned`. */
	toHaveNoOrphanedEffects(): R;
	/** Every selected effect is `exactly-once` or `deduplicated` (and at least one is selected). */
	toBeEffectivelyOnce(selector: EffectSelector): R;
	/** Some selected effect has `outcome` in some case. */
	toHaveOutcome(selector: EffectSelector, outcome: Outcome): R;
}

/** The part of Vitest's matcher context ReplayGuard uses (stable across Vitest 3.2 and 4). */
export interface MatcherContext {
	/** Whether the assertion is negated with `.not`. */
	isNot: boolean;
}

/** A synchronous matcher result. */
export interface ExpectationResult {
	/** Whether the assertion holds (before negation). */
	pass: boolean;
	/** Failure message. */
	message: () => string;
}

/** A matcher implementation for `expect.extend`. */
export type MatcherImpl<A extends unknown[]> = (
	this: MatcherContext,
	received: unknown,
	...args: A
) => ExpectationResult;

/** The matcher implementations by name. */
// A type alias (not an interface) so it is assignable to Vitest's `MatchersObject` index signature.
export type ReplayGuardMatcherImpls = {
	/** See {@link ReplayGuardMatchers.toPassSideEffectPolicy}. */
	toPassSideEffectPolicy: MatcherImpl<[Policy?]>;
	/** See {@link ReplayGuardMatchers.toHaveNoDuplicateEffects}. */
	toHaveNoDuplicateEffects: MatcherImpl<[]>;
	/** See {@link ReplayGuardMatchers.toHaveNoOrphanedEffects}. */
	toHaveNoOrphanedEffects: MatcherImpl<[]>;
	/** See {@link ReplayGuardMatchers.toBeEffectivelyOnce}. */
	toBeEffectivelyOnce: MatcherImpl<[EffectSelector]>;
	/** See {@link ReplayGuardMatchers.toHaveOutcome}. */
	toHaveOutcome: MatcherImpl<[EffectSelector, Outcome]>;
};

interface Verdict {
	pass: boolean;
	message: string;
	negatedMessage: string;
}

type Evaluate<A extends unknown[]> = (report: Report, ...args: A) => Verdict;

/** Template Method: normalize input → evaluate → message by negation. */
function createMatcher<A extends unknown[]>(
	evaluate: Evaluate<A>,
	policyOf: (...args: A) => Policy | undefined = () => undefined,
) {
	return function (this: MatcherContext, received: unknown, ...args: A): ExpectationResult {
		let report: Report;
		try {
			report = normalize(received, policyOf(...args)).report;
		} catch (error) {
			const message = (error as Error).message;
			return { pass: this.isNot, message: () => message };
		}
		const verdict = evaluate(report, ...args);
		return {
			pass: verdict.pass,
			message: () => (this.isNot ? verdict.negatedMessage : verdict.message),
		};
	};
}

function noneOf(outcomes: readonly Outcome[], label: string): Evaluate<[]> {
	return (report) => {
		const found = collectViolations(report, (e) => outcomes.includes(e.outcome));
		return {
			pass: found.length === 0,
			message: formatViolations(`expected no ${label} effects, but found ${found.length}:`, found),
			negatedMessage: `expected ${label} effects, but found none`,
		};
	};
}

const toPassSideEffectPolicy = createMatcher<[Policy?]>(
	(report) => {
		const effects = collectViolations(report, (e) => e.verdict === "fail");
		const cases: Violation[] = report.cases
			.filter((c) => c.verdict === "fail" && c.effects.every((e) => e.verdict !== "fail"))
			.map((c) => ({
				caseName: c.name,
				identity: "case",
				kind: "case",
				subject: "",
				outcome: "FAIL",
				verdict: "fail",
				explanation: c.warnings[0] ?? `case ended ${c.status}`,
			}));
		const all = [...effects, ...cases];
		const what = effects.length > 0 ? `${all.length} effect(s)` : `${all.length} case(s)`;
		return {
			pass: all.length === 0,
			message: formatViolations(
				`expected side effects to pass the policy, but ${what} failed:`,
				all,
			),
			negatedMessage: "expected side effects to violate the policy, but every effect passed",
		};
	},
	(policy) => policy,
);

const toBeEffectivelyOnce = createMatcher<[EffectSelector]>((report, selector) => {
	const name = describeSelector(selector);
	const selected = collectViolations(report, (e) => selects(selector, e));
	const offending = selected.filter(
		(v) => v.outcome !== "exactly-once" && v.outcome !== "deduplicated",
	);
	return {
		pass: selected.length > 0 && offending.length === 0,
		message:
			selected.length === 0
				? `expected ${name} to be effectively once, but no effect matched it`
				: formatViolations(
						`expected ${name} to be effectively once, but ${offending.length} effect(s) were not:`,
						offending,
					),
		negatedMessage: `expected ${name} not to be effectively once, but every matching effect was exactly-once or deduplicated`,
	};
});

const toHaveOutcome = createMatcher<[EffectSelector, Outcome]>((report, selector, outcome) => {
	const name = describeSelector(selector);
	const selected = collectViolations(report, (e) => selects(selector, e));
	const matching = selected.filter((v) => v.outcome === outcome);
	return {
		pass: matching.length > 0,
		message:
			selected.length === 0
				? `expected an effect matching ${name} to be ${outcome}, but no effect matched it`
				: formatViolations(
						`expected an effect matching ${name} to be ${outcome}, but found:`,
						selected,
					),
		negatedMessage: formatViolations(
			`expected no effect matching ${name} to be ${outcome}, but found ${matching.length}:`,
			matching,
		),
	};
});

/**
 * The matcher implementations, for `expect.extend(replayGuardMatchers)`.
 *
 * @example
 * import { expect } from "vitest";
 * expect.extend(replayGuardMatchers);
 */
export const replayGuardMatchers: ReplayGuardMatcherImpls = {
	toPassSideEffectPolicy,
	toHaveNoDuplicateEffects: createMatcher(
		noneOf(["duplicated", "concurrent-duplicate"], "duplicated"),
	),
	toHaveNoOrphanedEffects: createMatcher(noneOf(["orphaned"], "orphaned")),
	toBeEffectivelyOnce,
	toHaveOutcome,
};
