import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { manualClock } from "../../src/ports/clock.js";
import { buildReport } from "../../src/report/build.js";
import { caseResult, scenarioResult } from "../classifier/arbitraries.js";
import { checkoutClassified } from "./fixtures.js";

const clock = manualClock(Date.UTC(2026, 9, 28, 12));

describe("buildReport (US1)", () => {
	it("summarizes cases, outcomes, verdicts and skipped candidates", () => {
		const report = buildReport(checkoutClassified(), { clock });
		expect(report.version).toBe(1);
		expect(report.generatedAt).toBe("2026-10-28T12:00:00.000Z");
		expect(report.scenario).toEqual({ name: "s", runtime: "fake", workflowId: "wf", seed: 1 });
		expect(report.summary).toEqual({
			cases: 2,
			verdict: "fail",
			outcomes: {
				"exactly-once": 0,
				deduplicated: 1,
				duplicated: 1,
				"concurrent-duplicate": 0,
				orphaned: 0,
				skipped: 0,
			},
			verdicts: { pass: 1, warn: 0, fail: 1 },
			skippedCandidates: 1,
		});
		expect(report.baselineAnomalies).toEqual([]);
		expect(report.cases.map((c) => c.name)).toEqual([
			"baseline",
			"crash after payment",
			"lost response",
		]);
	});

	it("describes each case with human-readable faults and effect reports", () => {
		const [, crashed] = buildReport(checkoutClassified(), { clock }).cases;
		expect(crashed).toMatchObject({
			index: 1,
			origin: "explicit",
			faults: ["crash after payment#1"],
			status: "settled",
			finalState: "completed",
			runs: 2,
			restarts: 1,
			durationMs: 1,
			verdict: "fail",
			warnings: [],
		});
		expect(crashed?.effects).toEqual([
			{
				identity: "payment::o-1",
				kind: "payment",
				subject: "o-1",
				outcome: "duplicated",
				verdict: "fail",
				applied: 2,
				deduplicated: 0,
				failed: 0,
				expected: 1,
				explanation: expect.stringContaining("payment applied 2× (expected 1)."),
				hints: [expect.objectContaining({ id: "add-idempotency-key" })],
			},
		]);
	});

	it("builds a timeline relative to the first run, with fault labels", () => {
		const [, crashed] = buildReport(checkoutClassified(), { clock }).cases;
		expect(crashed?.timeline).toEqual([
			{ type: "run", runIndex: 0, start: 0, end: 12, endReason: "crashed" },
			{ type: "run", runIndex: 1, start: 20, end: 40, endReason: "completed" },
			{
				type: "attempt",
				seq: 1,
				runIndex: 0,
				kind: "payment",
				subject: "o-1",
				start: 0,
				end: 10,
				status: "applied",
			},
			{
				type: "attempt",
				seq: 2,
				runIndex: 1,
				kind: "payment",
				subject: "o-1",
				start: 30,
				end: 35,
				status: "applied",
			},
			{ type: "fault", id: "F1", runIndex: 0, at: 12, label: "crash after payment#1" },
		]);
	});

	it("starts at the first attempt without runs and omits missing ends", () => {
		const result = scenarioResult(
			caseResult(0, [{ start: 50, end: undefined, status: "started" }]),
			[],
		);
		const [baseline] = buildReport(classify(result), { clock }).cases;
		expect(baseline?.timeline).toEqual([
			{
				type: "attempt",
				seq: 1,
				runIndex: 0,
				kind: "payment",
				subject: "o-1",
				start: 0,
				status: "started",
			},
		]);
		expect(baseline?.warnings).toEqual([
			"attempt #1 (payment::o-1) was still in flight when the case ended",
		]);
	});

	it("reports unsettled cases and an empty scenario", () => {
		const result = scenarioResult(
			caseResult(0, [], { status: "budget-exceeded", final: undefined }),
			[],
		);
		const report = buildReport(classify(result), { clock });
		expect(report.summary.cases).toBe(0);
		expect(report.cases[0]?.finalState).toBe("unsettled");
		expect(report.cases[0]?.timeline).toEqual([]);
		expect(report.baselineAnomalies).toEqual([
			'baseline did not complete (state "budget-exceeded")',
		]);
	});

	it("uses the system clock by default", () => {
		// systemClock is monotonic (performance.timeOrigin + now) and may trail Date.now() slightly.
		const at = Date.parse(buildReport(checkoutClassified()).generatedAt);
		expect(Math.abs(at - Date.now())).toBeLessThan(5_000);
	});
});
