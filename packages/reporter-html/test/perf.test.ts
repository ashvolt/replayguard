import type { CaseReport, Report } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { renderHtml } from "../src/index.js";
import { checkoutReport } from "./support/report.js";

describe("HTML size and speed (T023)", () => {
	it("renders 100 cases under 1 MB in under 200 ms", async () => {
		const base = checkoutReport();
		const template = base.cases[1] as CaseReport;
		const report: Report = {
			...base,
			cases: [
				base.cases[0] as CaseReport,
				...Array.from({ length: 100 }, (_, i) => ({
					...template,
					index: i + 1,
					name: `case ${i + 1}`,
				})),
			],
		};
		const doc = await renderHtml(report); // warm-up
		// Best of several runs: robust to CPU contention from parallel test workers.
		const samples: number[] = [];
		for (let run = 0; run < 5; run++) {
			const start = performance.now();
			await renderHtml(report);
			samples.push(performance.now() - start);
		}
		const elapsed = Math.min(...samples);
		expect(new TextEncoder().encode(doc).length).toBeLessThan(1_000_000);
		expect(elapsed).toBeLessThan(200);
	});
});
