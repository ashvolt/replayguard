import { describe, expect, it } from "vitest";
import { manualClock } from "../../src/ports/clock.js";
import { buildReport } from "../../src/report/build.js";
import { type ReportVisitor, walkReport } from "../../src/report/visitor.js";
import { checkoutClassified } from "./fixtures.js";

describe("walkReport (Visitor)", () => {
	it("visits report → case → effects → timeline in order", () => {
		const report = buildReport(checkoutClassified(), { clock: manualClock(0) });
		const order: string[] = [];
		const visitor: ReportVisitor<string[]> = {
			visitReport: (r) => order.push(`report ${r.scenario.name}`),
			visitCase: (c, r) => order.push(`case ${c.index}/${r.cases.length}`),
			visitEffect: (e, c) => order.push(`effect ${c.index} ${e.outcome}`),
			visitTimelineEvent: (e, c) => order.push(`event ${c.index} ${e.type}`),
			result: () => order,
		};
		expect(walkReport(report, visitor)).toEqual([
			"report s",
			"case 0/3",
			"effect 0 exactly-once",
			"event 0 attempt",
			"case 1/3",
			"effect 1 duplicated",
			"event 1 run",
			"event 1 run",
			"event 1 attempt",
			"event 1 attempt",
			"event 1 fault",
			"case 2/3",
			"effect 2 deduplicated",
			"event 2 attempt",
			"event 2 attempt",
		]);
	});

	it("skips hooks a visitor does not define", () => {
		const report = buildReport(checkoutClassified(), { clock: manualClock(0) });
		let cases = 0;
		expect(walkReport(report, { visitCase: () => cases++, result: () => cases })).toBe(3);
	});
});
