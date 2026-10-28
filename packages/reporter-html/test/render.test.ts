import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseReport, type Report, reportToJson } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { FILTER_SCRIPT, STYLES } from "../src/assets.js";
import { sha256Base64 } from "../src/csp.js";
import { htmlReporter, renderHtml, writeHtmlReport } from "../src/index.js";
import { checkoutReport } from "./support/report.js";

const between = (s: string, start: string, end: string) => {
	const i = s.indexOf(start);
	return s.slice(i + start.length, s.indexOf(end, i + start.length));
};

describe("renderHtml (T018)", () => {
	it("is a single self-contained document without external references", async () => {
		const doc = await renderHtml(checkoutReport());
		expect(doc.startsWith('<!doctype html>\n<html lang="en">')).toBe(true);
		expect(doc).not.toMatch(/https?:\/\//);
		expect(doc).not.toMatch(/\s(src|href|action)=/);
		expect(doc).not.toMatch(/\sstyle=/);
		expect(doc).not.toMatch(/\son[a-z]+=/);
		expect(doc).toContain('<meta name="color-scheme" content="light dark">');
		expect(doc).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
		expect(doc).toContain("<title>ReplayGuard: checkout - FAIL</title>");
	});

	it("has a strict CSP whose hashes match the inline style and script", async () => {
		const doc = await renderHtml(checkoutReport());
		const csp = between(
			doc,
			'<meta http-equiv="Content-Security-Policy" content="',
			'">',
		).replaceAll("&#39;", "'");
		const style = between(doc, "<style>", "</style>");
		const script = between(doc, "<script>", "</script>");
		expect(style).toBe(STYLES);
		expect(script).toBe(FILTER_SCRIPT);
		expect(csp).toBe(
			`default-src 'none'; style-src 'sha256-${await sha256Base64(STYLES)}'; script-src 'sha256-${await sha256Base64(FILTER_SCRIPT)}'; img-src data:; base-uri 'none'; form-action 'none'`,
		);
		expect(FILTER_SCRIPT.length).toBeLessThanOrEqual(2048);
		expect(await sha256Base64("abc")).toBe("ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");
	});

	it("embeds the report as escaped JSON that parses back", async () => {
		const report = checkoutReport();
		const evil: Report = {
			...report,
			cases: report.cases.map((c, i) =>
				i === 1
					? { ...c, name: `</script><script>alert(1)</script>${String.fromCharCode(0x2028)}` }
					: c,
			),
		};
		const doc = await renderHtml(evil);
		const data = between(doc, '<script type="application/json" id="rg-data">', "</script>");
		expect(data).not.toMatch(new RegExp(`[<>${String.fromCharCode(0x2028)}]`));
		expect(parseReport(data)).toEqual(evil);
		expect(doc).not.toContain("<script>alert(1)");
		expect(doc).toContain("&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
	});

	it("renders summary, legend, keyboard-operable filters and one section per case", async () => {
		const doc = await renderHtml(checkoutReport());
		expect(doc).toContain('<label for="rg-verdict">Verdict</label>');
		expect(doc).toContain('<select id="rg-verdict">');
		expect(doc).toContain('<label for="rg-outcome">Outcome</label>');
		expect(doc).toContain('<option value="concurrent-duplicate">concurrent-duplicate</option>');
		expect(doc).toContain('<p id="rg-count" aria-live="polite">5 of 5 cases shown</p>');
		expect(doc.split('<section class="rg-case"').length - 1).toBe(5);
		expect(doc).toContain(
			'<section class="rg-case" id="case-1" data-verdict="fail" data-outcomes="duplicated exactly-once">',
		);
		expect(doc).toContain('<span class="rg-badge rg-o-duplicated">duplicated</span>');
		expect(doc).toContain('<span class="rg-badge rg-v-fail">FAIL</span>');
		expect(doc).toContain("<details");
		expect(doc).toContain("<h4>Send a stable idempotency key with the call</h4>");
		expect(doc).toContain("<pre><code>await ctx.step(&quot;charge&quot;");
		expect(doc).toContain("harness error: child process exited before ready");
		expect(doc).toContain("2 candidate(s) not run (budget)");
	});

	it("lists baseline anomalies and states when no fault cases ran", async () => {
		const r = checkoutReport();
		const doc = await renderHtml({
			...r,
			summary: { ...r.summary, cases: 0 },
			baselineAnomalies: ["baseline has overlapping calls for payment::o-1"],
			cases: [r.cases[0] as Report["cases"][number]],
		});
		expect(doc).toContain("<li>baseline has overlapping calls for payment::o-1</li>");
		expect(doc).toContain("No fault cases ran (baseline only).");
	});

	it("uses a custom title and is pure", async () => {
		const a = await renderHtml(checkoutReport(), { title: "Nightly <run>" });
		expect(a).toContain("<title>Nightly &lt;run&gt;</title>");
		expect(await renderHtml(checkoutReport())).toBe(await renderHtml(checkoutReport()));
	});
});

describe("writeHtmlReport and htmlReporter", () => {
	it("writes to the given path, creating directories", async () => {
		const dir = await mkdtemp(join(tmpdir(), "rg-html-"));
		try {
			const path = join(dir, "nested", "report.html");
			await writeHtmlReport(checkoutReport(), path);
			expect(await readFile(path, "utf8")).toBe(await renderHtml(checkoutReport()));
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("renders through the Reporter port", async () => {
		const reporter = htmlReporter({ title: "T" });
		expect(reporter.name).toBe("html");
		expect(await reporter.render(checkoutReport())).toBe(
			await renderHtml(checkoutReport(), { title: "T" }),
		);
		expect(reportToJson(checkoutReport())).toContain('"version": 1');
	});
});
