import type { CaseResult, ScenarioResult } from "../scenario/result.js";
import { buildEvidence, expectedCounts } from "./evidence.js";
import { explain } from "./explain.js";
import { resolveVerdict, validatePolicy, worstVerdict } from "./policy.js";
import { classifyEvidence } from "./rules.js";
import type {
	CaseClassification,
	ClassifiedResult,
	EffectClassification,
	Policy,
	VerdictLevel,
} from "./types.js";

function baselineAnomalies(baseline: CaseResult, expected: ReadonlyMap<string, number>): string[] {
	const anomalies: string[] = [];
	if (baseline.status !== "settled" || baseline.final?.state !== "completed") {
		anomalies.push(
			`baseline did not complete (state "${baseline.final?.state ?? baseline.status}")`,
		);
	}
	for (const e of buildEvidence(baseline, expected)) {
		if (e.overlaps.length > 0) anomalies.push(`baseline has overlapping calls for ${e.identity}`);
		if (e.deduplicated > 0) anomalies.push(`baseline deduplicated ${e.identity} without any fault`);
	}
	return anomalies;
}

function classifyCase(
	c: CaseResult,
	expected: ReadonlyMap<string, number>,
	policy: Policy,
): CaseClassification {
	const warnings: string[] = [];
	if (c.status === "harness-error")
		warnings.push(`harness error: ${c.harnessError?.message ?? "unknown"}`);
	if (c.status === "budget-exceeded")
		warnings.push("case exceeded its budget; the workflow never settled");
	const effects: EffectClassification[] = [];
	const neverApplied: string[] = [];
	for (const e of buildEvidence(c, expected)) {
		for (const seq of e.unsettled)
			warnings.push(`attempt #${seq} (${e.identity}) was still in flight when the case ended`);
		const outcome = classifyEvidence(e);
		if (outcome === undefined) {
			if (e.attemptSeqs.length > e.unsettled.length)
				neverApplied.push(
					`${e.identity} was attempted but never applied (workflow ${e.workflowState})`,
				);
			continue;
		}
		effects.push({
			identity: e.identity,
			kind: e.kind,
			subject: e.subject,
			outcome,
			verdict: resolveVerdict(policy, e.kind, e.identity, outcome),
			evidence: e,
			explanation: explain(e, outcome, c),
			hints: [],
		});
	}
	warnings.push(...neverApplied);
	const verdicts: VerdictLevel[] = effects.map((e) => e.verdict);
	if (c.status === "harness-error") verdicts.push("fail");
	if (c.status === "budget-exceeded") verdicts.push("warn");
	return { caseIndex: c.index, name: c.name, effects, verdict: worstVerdict(verdicts), warnings };
}

/**
 * Classifies every effect in every case (pure function of the result and the policy).
 *
 * @example
 * const classified = classify(await myScenario.run(), { kinds: { email: { duplicated: "pass" } } });
 * classified.verdict; // "pass" | "warn" | "fail"
 */
export function classify(result: ScenarioResult, policy: Policy = {}): ClassifiedResult {
	validatePolicy(policy);
	const expected = expectedCounts(result.baseline);
	const cases = [result.baseline, ...result.cases].map((c) => classifyCase(c, expected, policy));
	return {
		version: 1,
		result,
		cases,
		verdict: worstVerdict(cases.map((c) => c.verdict)),
		baselineAnomalies: baselineAnomalies(result.baseline, expected),
		policy,
	};
}
