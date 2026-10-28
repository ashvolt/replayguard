import { describe, expect, it } from "vitest";
import { classifyEvidence, OUTCOME_RULES, OUTCOME_SEVERITY } from "../../src/classifier/rules.js";
import type { Evidence } from "../../src/classifier/types.js";

const ev = (over: Partial<Evidence>): Evidence => ({
	identity: "payment::o-1",
	kind: "payment",
	subject: "o-1",
	attemptSeqs: [1],
	applied: 1,
	deduplicated: 0,
	failed: 0,
	expected: 1,
	overlaps: [],
	keys: [],
	unsettled: [],
	workflowState: "completed",
	faultIds: [],
	...over,
});

describe("outcome rules (Specification pattern)", () => {
	it("are ordered by severity", () => {
		expect(OUTCOME_RULES.map((r) => r.outcome)).toEqual(OUTCOME_SEVERITY);
		expect(OUTCOME_SEVERITY).toEqual([
			"concurrent-duplicate",
			"duplicated",
			"orphaned",
			"skipped",
			"deduplicated",
			"exactly-once",
		]);
	});

	it.each<[string, Partial<Evidence>, string | undefined]>([
		["applied once", {}, "exactly-once"],
		["applied twice, expected once", { applied: 2 }, "duplicated"],
		["applied twice, expected twice", { applied: 2, expected: 2 }, "exactly-once"],
		["applied three, expected two", { applied: 3, expected: 2 }, "duplicated"],
		["applied twice, expected 0 (new effect)", { applied: 2, expected: 0 }, "duplicated"],
		["applied once, expected 0", { expected: 0 }, "exactly-once"],
		["overlapping applied pair", { applied: 2, overlaps: [[1, 2]] }, "concurrent-duplicate"],
		[
			"overlap with one applied only",
			{ applied: 1, deduplicated: 1, overlaps: [[1, 2]] },
			"deduplicated",
		],
		["applied, workflow failed", { workflowState: "failed" }, "orphaned"],
		["duplicated beats orphaned", { applied: 2, workflowState: "failed" }, "duplicated"],
		["applied, workflow waiting", { workflowState: "waiting" }, "exactly-once"],
		["expected, never applied, completed", { applied: 0, attemptSeqs: [] }, "skipped"],
		["expected, never applied, failed", { applied: 0, workflowState: "failed" }, undefined],
		["expected, failed attempts only, completed", { applied: 0, failed: 2 }, "skipped"],
		["deduplicated replay", { deduplicated: 1 }, "deduplicated"],
		["dedup only (no applied)", { applied: 0, deduplicated: 1 }, "deduplicated"],
		["dedup but duplicated", { applied: 2, deduplicated: 1 }, "duplicated"],
		["nothing applied, nothing expected", { applied: 0, expected: 0 }, undefined],
	])("%s → %s", (_label, over, outcome) => {
		expect(classifyEvidence(ev(over))).toBe(outcome);
	});
});
