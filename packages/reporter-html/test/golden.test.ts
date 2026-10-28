import type { CaseReport } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { renderHtml } from "../src/index.js";
import { renderTimeline } from "../src/timeline.js";
import { checkoutReport } from "./support/report.js";

describe("golden output (FR-006: pure renderers)", () => {
	it("matches the checkout document", async () => {
		await expect(await renderHtml(checkoutReport())).toMatchFileSnapshot("./golden/checkout.html");
	});

	it("matches every case timeline", async () => {
		const svgs = checkoutReport()
			.cases.map((c: CaseReport) => renderTimeline(c, { width: 400 }).value)
			.join("\n");
		await expect(`${svgs}\n`).toMatchFileSnapshot("./golden/timelines.svg.txt");
	});
});
