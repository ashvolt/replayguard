import type { CaseReport } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { renderTimeline } from "../src/timeline.js";
import { checkoutReport } from "./support/report.js";

const cases = checkoutReport().cases;
const crashed = cases[1] as CaseReport;
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe("renderTimeline (T017)", () => {
	it("draws one lane per run with labels", () => {
		const svg = renderTimeline(crashed).value;
		expect(svg).toMatch(/^<svg class="rg-timeline" viewBox="0 0 720 \d+" role="img"/);
		expect(count(svg, 'class="rg-lane"')).toBe(2);
		expect(svg).toContain(">run 0</text>");
		expect(svg).toContain(">run 1</text>");
		expect(svg).toContain(
			'<title id="rg-tl-1">Timeline of case 1: 2 runs, 3 attempts, 1 fault</title>',
		);
		expect(svg).toContain('aria-labelledby="rg-tl-1"');
	});

	it("draws attempt bars with status classes, patterns and titles", () => {
		const svg = renderTimeline(cases[2] as CaseReport).value;
		expect(count(svg, 'class="rg-bar rg-bar-applied"')).toBe(1);
		expect(svg).toContain('class="rg-bar rg-bar-deduplicated" fill="url(#rg-p2-dedup)"');
		expect(svg).toContain('<pattern id="rg-p2-dedup"');
		expect(svg).toContain("<title>#2 payment.charge o-1: deduplicated, 4–5 ms</title>");
	});

	it("outlines failed attempts and hatches attempts still in flight", () => {
		const c: CaseReport = {
			...crashed,
			index: 9,
			timeline: [
				{ type: "run", runIndex: 0, start: 0 },
				{
					type: "attempt",
					seq: 1,
					runIndex: 0,
					kind: "k",
					subject: "s",
					start: 0,
					end: 10,
					status: "failed",
				},
				{
					type: "attempt",
					seq: 2,
					runIndex: 0,
					kind: "k",
					subject: "s",
					start: 20,
					status: "started",
				},
			],
		};
		const svg = renderTimeline(c).value;
		expect(svg).toContain('class="rg-bar rg-bar-failed" fill="none"');
		expect(svg).toContain('class="rg-bar rg-bar-started" fill="url(#rg-p9-inflight)"');
		expect(svg).toContain("<title>#2 k s: started, 20 ms – still in flight</title>");
	});

	it("draws fault markers with labels", () => {
		const svg = renderTimeline(crashed).value;
		expect(count(svg, 'class="rg-fault"')).toBe(1);
		expect(svg).toContain("<title>F1 crash after payment.charge#1 at 6 ms</title>");
		expect(svg).toContain('class="rg-fault-label"');
	});

	it("gives zero-duration attempts a minimum width", () => {
		const svg = renderTimeline(cases[0] as CaseReport).value;
		expect(svg).toMatch(/<rect class="rg-bar rg-bar-applied"[^>]* width="2(\.0+)?"/);
	});

	it("scales to the latest event and escapes text", () => {
		const c: CaseReport = {
			...crashed,
			index: 7,
			timeline: [
				{
					type: "attempt",
					seq: 1,
					runIndex: 0,
					kind: "<k>",
					subject: '"s"',
					start: 0,
					end: 0,
					status: "applied",
				},
			],
		};
		const svg = renderTimeline(c).value;
		expect(svg).toContain("#1 &lt;k&gt; &quot;s&quot;");
		expect(svg).not.toContain("<k>");
		expect(svg).toContain(">run 0</text>");
	});

	it("says when there is nothing to draw", () => {
		expect(renderTimeline({ ...crashed, timeline: [] }).value).toBe(
			'<p class="rg-muted">No timeline events.</p>',
		);
	});
});
