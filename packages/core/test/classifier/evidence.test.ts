import { describe, expect, it } from "vitest";
import { buildEvidence, expectedCounts } from "../../src/classifier/evidence.js";
import { caseResult } from "./arbitraries.js";

describe("evidence", () => {
	const baseline = caseResult(0, [
		{},
		{ kind: "email", subject: "a" },
		{ kind: "email", subject: "a" },
		{ kind: "x", status: "failed" },
	]);

	it("derives expected counts from applied + deduplicated baseline attempts", () => {
		expect(expectedCounts(baseline)).toEqual(
			new Map([
				["payment::o-1", 1],
				["email::a", 2],
			]),
		);
	});

	it("counts statuses, overlaps, keys, unsettled and faults per identity", () => {
		const c = caseResult(
			1,
			[
				{ start: 0, end: 80, key: "k1" },
				{ start: 30, end: 40, status: "deduplicated", key: "k1" },
				{ start: 50, end: 60, key: "k2" },
				{ start: 90, end: 90 },
				{ start: 95, status: "started" },
				{ status: "failed" },
			],
			{ faults: [{ id: "F1" }] },
		);
		const [payment] = buildEvidence(c, expectedCounts(baseline));
		expect(payment).toEqual({
			identity: "payment::o-1",
			kind: "payment",
			subject: "o-1",
			attemptSeqs: [1, 2, 3, 4, 5, 6],
			applied: 3,
			deduplicated: 1,
			failed: 1,
			expected: 1,
			overlaps: [[1, 3]],
			keys: ["k1", "k2"],
			unsettled: [5],
			workflowState: "completed",
			faultIds: ["F1"],
		});
	});

	it("includes expected identities missing from the case and maps workflow states", () => {
		const skipped = buildEvidence(caseResult(1, []), expectedCounts(baseline));
		expect(skipped.map((e) => [e.identity, e.applied, e.expected])).toEqual([
			["payment::o-1", 0, 1],
			["email::a", 0, 2],
		]);
		const state = (opts: Parameters<typeof caseResult>[2]) =>
			buildEvidence(caseResult(1, [{}], opts), new Map())[0]?.workflowState;
		expect(state({ final: { state: "failed", error: { name: "E", message: "m" } } })).toBe(
			"failed",
		);
		expect(state({ final: { state: "waiting", names: [] } })).toBe("waiting");
		expect(state({ status: "budget-exceeded", final: undefined })).toBe("unsettled");
		expect(state({ final: { state: "sleeping", wakeAt: 1 } })).toBe("unsettled");
	});
});
