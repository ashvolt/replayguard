import type { ClassifiedResult } from "../classifier/types.js";
import { HINT_RULES, INVESTIGATE } from "./catalog.js";
import type { HintContext, HintRule } from "./types.js";

/**
 * Attaches fix hints to every non-passing effect (at least one, `investigate` as fallback);
 * passing effects get none. Returns a new result.
 *
 * @example
 * attachHints(classified).cases[1].effects[0].hints[0].id; // "add-idempotency-key"
 */
export function attachHints(
	classified: ClassifiedResult,
	rules: readonly HintRule[] = HINT_RULES,
): ClassifiedResult {
	const all = [classified.result.baseline, ...classified.result.cases];
	return {
		...classified,
		cases: classified.cases.map((c) => {
			const source = all.find((r) => r.index === c.caseIndex);
			return {
				...c,
				effects: c.effects.map((effect) => {
					if (effect.verdict === "pass") return { ...effect, hints: [] };
					const context: HintContext = {
						outcome: effect.outcome,
						faults: source?.faults ?? [],
						faultEvents: source?.ledger.faults ?? [],
						finalState: effect.evidence.workflowState,
					};
					const hints = rules
						.filter(
							(r) => r.outcomes.includes(effect.outcome) && r.matches(effect.evidence, context),
						)
						.map((r) => r.render(effect.evidence, context));
					return {
						...effect,
						hints: hints.length > 0 ? hints : [INVESTIGATE.render(effect.evidence, context)],
					};
				}),
			};
		}),
	};
}
