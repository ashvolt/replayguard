import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { caseResult, scenarioResult } from "./arbitraries.js";

const explain = (c: ReturnType<typeof caseResult>, base = caseResult(0, [{}])) =>
	classify(scenarioResult(base, [c])).cases[1]?.effects[0]?.explanation;

describe("explanations (US4)", () => {
	it("exactly-once and deduplicated", () => {
		expect(explain(caseResult(1, [{}]))).toBe("payment applied once.");
		expect(
			explain(caseResult(1, [{ key: "k" }, { key: "k", status: "deduplicated", start: 9 }])),
		).toBe(
			'payment was attempted 2× and the provider deduplicated 1 replay(s) (idempotency key "k"); applied once.',
		);
	});

	it("duplicated by a crash names the fault, the applied attempt and the re-execution", () => {
		expect(
			explain(
				caseResult(1, [{ run: 0 }, { run: 1, start: 50 }], {
					faults: [{ id: "F1", strategy: "crash", anchor: "crash after payment#1", runIndex: 0 }],
					restarts: 1,
				}),
			),
		).toBe(
			"payment applied 2× (expected 1). Fault F1 (crash after payment#1) stopped run 0 after the effect applied but before the step result was saved; run 1 re-executed the step.",
		);
	});

	it("duplicated by a lost response or without a fault", () => {
		expect(
			explain(
				caseResult(1, [{}, { start: 50 }], {
					faults: [{ id: "F1", strategy: "throwAfter", anchor: "lost response after payment#1" }],
				}),
			),
		).toBe(
			"payment applied 2× (expected 1). Fault F1 (lost response after payment#1) hid the provider's response, so the step retried and called the provider again.",
		);
		expect(explain(caseResult(1, [{}, { start: 50 }]))).toBe(
			"payment applied 2× (expected 1). No injected fault explains it: the workflow called the effect more often than in the baseline.",
		);
		expect(
			explain(
				caseResult(1, [{}, { start: 50 }], {
					faults: [{ id: "F1", strategy: "processKill", anchor: "process kill after payment#1" }],
				}),
			),
		).toContain("Fault F1 (process kill after payment#1) stopped run 0");
	});

	it("concurrent duplicates, orphans and skips", () => {
		expect(
			explain(
				caseResult(
					1,
					[
						{ start: 0, end: 80 },
						{ start: 25, end: 26 },
					],
					{ faults: [{ id: "F1", strategy: "delay", anchor: "delay 80ms in payment#1" }] },
				),
			),
		).toBe(
			"payment applied 2× with overlapping calls: attempt #1 was still in flight when attempt #2 started. Fault F1 (delay 80ms in payment#1) made the provider hang past the step timeout; the timed-out call kept running while the retry called the provider again.",
		);
		expect(
			explain(
				caseResult(1, [
					{ start: 0, end: 80 },
					{ start: 25, end: 26 },
				]),
			),
		).toBe(
			"payment applied 2× with overlapping calls: attempt #1 was still in flight when attempt #2 started.",
		);
		expect(
			explain(
				caseResult(1, [{}], {
					final: { state: "failed", error: { name: "StepTimeoutError", message: "t" } },
					faults: [{ id: "F1", strategy: "delay", anchor: "delay 60ms in payment#1" }],
				}),
			),
		).toBe(
			'payment applied 1× but the workflow ended "failed" (StepTimeoutError), so nothing records or compensates the effect. Fault F1 (delay 60ms in payment#1) made the provider hang past the step timeout.',
		);
		expect(
			explain(
				caseResult(1, [], {
					faults: [{ id: "F1", strategy: "throwAfter", anchor: "lost request before payment#1" }],
				}),
			),
		).toBe(
			"payment was expected 1× (baseline) but never applied, yet the workflow completed. Fault F1 (lost request before payment#1) dropped the request and the workflow did not retry it.",
		);
		expect(explain(caseResult(1, []))).toBe(
			"payment was expected 1× (baseline) but never applied, yet the workflow completed.",
		);
	});
});
