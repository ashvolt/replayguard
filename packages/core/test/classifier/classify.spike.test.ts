import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { caseResult, scenarioResult } from "./arbitraries.js";

const baseline = caseResult(0, [{}]);
const outcomeOf = (c: ReturnType<typeof caseResult>) =>
	classify(scenarioResult(baseline, [c])).cases[1]?.effects.map((e) => e.outcome);

describe("spike hypotheses classify as expected (SC-001)", () => {
	it("H1 crash after charge → duplicated", () => {
		expect(
			outcomeOf(caseResult(1, [{ run: 0 }, { run: 1, start: 50 }], { faults: [{}], restarts: 1 })),
		).toEqual(["duplicated"]);
	});

	it("H1b with idempotency key → deduplicated", () => {
		expect(
			outcomeOf(
				caseResult(1, [
					{ key: "wf:charge" },
					{ key: "wf:charge", status: "deduplicated", start: 50 },
				]),
			),
		).toEqual(["deduplicated"]);
	});

	it("H3a delay + retryOnTimeout → concurrent-duplicate", () => {
		expect(
			outcomeOf(
				caseResult(
					1,
					[
						{ start: 0, end: 80 },
						{ start: 25, end: 26 },
					],
					{ faults: [{ strategy: "delay" }] },
				),
			),
		).toEqual(["concurrent-duplicate"]);
	});

	it("H3b delay + critical timeout → orphaned", () => {
		expect(
			outcomeOf(
				caseResult(1, [{ start: 0, end: 60 }], {
					final: { state: "failed", error: { name: "StepTimeoutError", message: "t" } },
				}),
			),
		).toEqual(["orphaned"]);
	});

	it("lost request swallowed → skipped", () => {
		expect(outcomeOf(caseResult(1, []))).toEqual(["skipped"]);
	});

	it("crash before the effect, re-executed after restart → exactly-once", () => {
		expect(outcomeOf(caseResult(1, [{ run: 1 }], { restarts: 1 }))).toEqual(["exactly-once"]);
	});
});
