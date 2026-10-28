import type { CaseReport, EffectReport, Report } from "@replayguard/core";

/** Selects effects: a kind (exact or `.`/`:` prefix), an identity, or a predicate. */
export type EffectSelector = string | ((effect: EffectReport) => boolean);

/** One offending effect (or case) in a matcher message. */
export interface Violation {
	/** Case name. */
	caseName: string;
	/** Logical identity (or `case`). */
	identity: string;
	/** Effect kind (or `case`). */
	kind: string;
	/** Effect subject. */
	subject: string;
	/** Outcome (or the case verdict). */
	outcome: string;
	/** Verdict. */
	verdict: string;
	/** Explanation. */
	explanation: string;
}

const LIMIT = 20;

/**
 * Whether the selector picks the effect.
 *
 * @example
 * selects("payment", effect); // true for kinds "payment", "payment.charge"
 */
export function selects(selector: EffectSelector, effect: EffectReport): boolean {
	if (typeof selector === "function") return selector(effect);
	return (
		effect.kind === selector ||
		effect.kind.startsWith(`${selector}.`) ||
		effect.kind.startsWith(`${selector}:`) ||
		effect.identity === selector
	);
}

/**
 * Human-readable selector for messages.
 *
 * @example
 * describeSelector("payment"); // '"payment"'
 */
export function describeSelector(selector: EffectSelector): string {
	return typeof selector === "string" ? JSON.stringify(selector) : selector.name || "predicate";
}

/**
 * Effects matching `predicate`, with their case, in report order.
 *
 * @example
 * collectViolations(report, (e) => e.outcome === "orphaned");
 */
export function collectViolations(
	report: Report,
	predicate: (effect: EffectReport, c: CaseReport) => boolean,
): Violation[] {
	return report.cases.flatMap((c) =>
		c.effects
			.filter((e) => predicate(e, c))
			.map((e) => ({
				caseName: c.name,
				identity: e.identity,
				kind: e.kind,
				subject: e.subject,
				outcome: e.outcome,
				verdict: e.verdict,
				explanation: e.explanation,
			})),
	);
}

/**
 * Header plus up to 20 violation lines and a count of the rest.
 *
 * @example
 * formatViolations("expected no duplicated effects, but found 2:", violations);
 */
export function formatViolations(header: string, violations: readonly Violation[]): string {
	const lines = violations
		.slice(0, LIMIT)
		.map(
			(v) =>
				`  • ${v.caseName} › ${v.kind}${v.subject ? ` ${v.subject}` : ""}: ${v.outcome} — ${v.explanation}`,
		);
	if (violations.length > LIMIT) lines.push(`  …and ${violations.length - LIMIT} more`);
	return [header, ...lines].join("\n");
}
