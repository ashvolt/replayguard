// Runtime conformance suite (spec 012 T003): every runtime must classify the spike scenarios
// (H0, H1, H1b, H3a, H3b, H4) the same way. Workflows are written differently per runtime (the
// RivetKit step API differs), so cases are data: each runtime builds the "checkout" workflow
// from a CheckoutShape and the suite compares classified outcomes only.
import type { ClassifiedResult, Outcome, RunOptions } from "@replayguard/core";
import { describe, expect, it } from "vitest";

import { CONFORMANCE_CASES, type ConformanceCase } from "./conformance-cases.mjs";

export {
	type CheckoutShape,
	CONFORMANCE_CASES,
	CONFORMANCE_GRACE_MS,
	type ConformanceCase,
	TIMEOUT_MS,
} from "./conformance-cases.mjs";

/** Builds a runnable scenario for a case (with the case's faults as its only explicit case). */
export type ScenarioFor = (c: ConformanceCase) => {
	run(options: RunOptions & { classify: true }): Promise<ClassifiedResult>;
};

const outcomesByKind = (classified: ClassifiedResult, index: number) =>
	Object.fromEntries(
		(classified.cases[index]?.effects ?? []).map((e) => [e.kind, e.outcome]),
	) as Record<string, Outcome>;

/**
 * Registers the conformance tests for one runtime.
 *
 * @example
 * runtimeConformanceSuite("workflowsRuntime", (c) => checkout(c).case(c.name, c.faults).build());
 */
export function runtimeConformanceSuite(
	name: string,
	scenarioFor: ScenarioFor,
	options: { timeoutMs?: number; cases?: readonly ConformanceCase[]; skip?: string } = {},
): void {
	const suite = options.skip === undefined ? describe : describe.skip;
	suite(`runtime conformance: ${name}${options.skip ? ` (skipped: ${options.skip})` : ""}`, () => {
		for (const c of options.cases ?? CONFORMANCE_CASES) {
			it(
				c.name,
				async () => {
					const classified = await scenarioFor(c).run({ classify: true });
					expect(classified.baselineAnomalies).toEqual([]);
					expect(classified.cases[0]?.verdict).toBe("pass");
					expect(outcomesByKind(classified, 1)).toEqual(c.expected);
				},
				options.timeoutMs ?? 30_000,
			);
		}
	});
}
