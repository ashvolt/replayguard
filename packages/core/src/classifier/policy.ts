import * as v from "valibot";
import { ConfigError } from "../errors.js";
import type { Outcome, OutcomeVerdicts, Policy, VerdictLevel } from "./types.js";

/** Strict built-in verdicts. */
export const DEFAULT_POLICY: Readonly<Record<Outcome, VerdictLevel>> = Object.freeze({
	"exactly-once": "pass",
	deduplicated: "pass",
	duplicated: "fail",
	"concurrent-duplicate": "fail",
	orphaned: "fail",
	skipped: "fail",
});

const OUTCOMES = Object.keys(DEFAULT_POLICY) as Outcome[];
const Verdicts = v.pipe(
	v.record(v.string(), v.picklist(["pass", "warn", "fail"], "verdict must be pass, warn or fail")),
	v.check(
		(r) => Object.keys(r).every((k) => OUTCOMES.includes(k as Outcome)),
		`outcomes must be one of ${OUTCOMES.join(", ")}`,
	),
);
const PolicySchema = v.strictObject({
	default: v.exactOptional(Verdicts),
	kinds: v.exactOptional(v.record(v.string(), Verdicts)),
	identities: v.exactOptional(v.record(v.string(), Verdicts)),
});

/**
 * Validates a policy, throwing `ConfigError`.
 *
 * @example
 * validatePolicy({ kinds: { email: { duplicated: "pass" } } });
 */
export function validatePolicy(policy: unknown): Policy {
	const result = v.safeParse(PolicySchema, policy);
	if (!result.success) {
		const issue = result.issues[0] as v.BaseIssue<unknown>;
		const path = (issue.path ?? []).map((p) => String(p.key)).join(".");
		throw new ConfigError(
			`invalid policy${path ? ` at ${path}` : ""}: ${issue.message}`,
			"RG_CONFIG_POLICY",
		);
	}
	return policy as Policy;
}

function kindOverride(
	kinds: Record<string, OutcomeVerdicts> | undefined,
	kind: string,
): OutcomeVerdicts | undefined {
	const keys = Object.keys(kinds ?? {})
		.filter((k) => kind === k || kind.startsWith(`${k}.`))
		.sort((a, b) => b.length - a.length);
	return keys[0] === undefined ? undefined : kinds?.[keys[0]];
}

/**
 * Verdict for an outcome: identity override → kind override (longest dotted prefix) → policy
 * default → built-in strict default (Chain of Responsibility).
 *
 * @example
 * resolveVerdict({ kinds: { email: { duplicated: "pass" } } }, "email.send", "email.send::a", "duplicated"); // "pass"
 */
export function resolveVerdict(
	policy: Policy,
	kind: string,
	identity: string,
	outcome: Outcome,
): VerdictLevel {
	return (
		policy.identities?.[identity]?.[outcome] ??
		kindOverride(policy.kinds, kind)?.[outcome] ??
		policy.default?.[outcome] ??
		DEFAULT_POLICY[outcome]
	);
}

const RANK: Record<VerdictLevel, number> = { pass: 0, warn: 1, fail: 2 };

/**
 * The worst of several verdicts (`pass` when empty).
 *
 * @example
 * worstVerdict(["pass", "warn"]); // "warn"
 */
export function worstVerdict(verdicts: readonly VerdictLevel[]): VerdictLevel {
	return verdicts.reduce<VerdictLevel>((worst, v) => (RANK[v] > RANK[worst] ? v : worst), "pass");
}
