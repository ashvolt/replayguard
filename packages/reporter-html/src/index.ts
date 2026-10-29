import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
	type CaseReport,
	type EffectReport,
	REPORT_OUTCOMES,
	type Report,
	type Reporter,
	reportToJson,
} from "@replayguard/core";
import { FILTER_SCRIPT, STYLES } from "./assets.js";
import { contentSecurityPolicy } from "./csp.js";
import { escapeJsonForScript, html, raw, type SafeHtml } from "./html.js";
import { renderTimeline } from "./timeline.js";

export { FILTER_SCRIPT, STYLES } from "./assets.js";
export { contentSecurityPolicy, sha256Base64 } from "./csp.js";
export { escapeHtml, escapeJsonForScript, html, raw, SafeHtml } from "./html.js";
export { renderTimeline } from "./timeline.js";

/** HTML rendering options. */
export interface HtmlOptions {
	/** Document title (default `ReplayGuard: <scenario> - <VERDICT>`). */
	title?: string;
}

const OUTCOME_LEGEND: Record<string, string> = {
	"exactly-once": "applied as often as in the baseline",
	deduplicated: "repeated, but the provider recognized the replay",
	duplicated: "applied more often than in the baseline",
	"concurrent-duplicate": "applied again while an earlier call was still running",
	orphaned: "applied, then the workflow failed",
	skipped: "expected but never applied, yet the workflow completed",
};

const badge = (kind: "o" | "v", value: string, label = value) =>
	html`<span class="rg-badge rg-${kind}-${value}">${label}</span>`;

function effectDetails(e: EffectReport): SafeHtml {
	return html`<details${e.verdict === "pass" ? "" : html` open`}><summary>${e.identity}: ${badge("o", e.outcome)} ${badge("v", e.verdict, e.verdict.toUpperCase())}</summary><p>${e.explanation}</p>${e.hints.map(
		(h) => html`<h4>${h.title}</h4><p>${h.explanation}</p><pre><code>${h.example}</code></pre>`,
	)}</details>`;
}

function caseSection(c: CaseReport): SafeHtml {
	const outcomes = [...new Set(c.effects.map((e) => e.outcome))].join(" ");
	const meta = [
		c.origin,
		c.faults.length > 0 ? `faults: ${c.faults.join(", ")}` : "no faults",
		`${c.runs} run(s)`,
		`${c.restarts} restart(s)`,
		`${Math.round(c.durationMs)} ms`,
		`final: ${c.finalState}`,
		...(c.status === "settled" ? [] : [c.status]),
	].join(" · ");
	return html`<section class="rg-case" id="case-${c.index}" data-verdict="${c.verdict}" data-outcomes="${outcomes}"><h2>[${c.index}] ${c.name} ${badge("v", c.verdict, c.verdict.toUpperCase())}</h2><p class="rg-meta">${meta}</p>${
		c.effects.length === 0
			? html`<p class="rg-muted">No effects recorded.</p>`
			: html`<div class="rg-scroll"><table><thead><tr><th scope="col">Effect</th><th scope="col">Outcome</th><th scope="col">Verdict</th><th scope="col">Applied</th><th scope="col">Deduplicated</th><th scope="col">Failed</th><th scope="col">Expected</th></tr></thead><tbody>${c.effects.map(
					(e) =>
						html`<tr><td>${e.identity}</td><td>${badge("o", e.outcome)}</td><td>${badge("v", e.verdict, e.verdict.toUpperCase())}</td><td>${e.applied}</td><td>${e.deduplicated}</td><td>${e.failed}</td><td>${e.expected}</td></tr>`,
				)}</tbody></table></div>${c.effects.map(effectDetails)}`
	}${renderTimeline(c)}${
		c.warnings.length > 0
			? html`<ul class="rg-warnings">${c.warnings.map((w) => html`<li>${w}</li>`)}</ul>`
			: ""
	}</section>`;
}

function body(report: Report): SafeHtml {
	const { scenario, summary } = report;
	const outcomes = REPORT_OUTCOMES.filter((o) => summary.outcomes[o] > 0);
	return html`<header><h1>ReplayGuard report: ${scenario.name}</h1><p>${badge("v", summary.verdict, summary.verdict.toUpperCase())} <span class="rg-meta">${scenario.runtime} runtime · workflow ${scenario.workflowId} · seed ${scenario.seed} · generated ${report.generatedAt}</span></p></header><main><section aria-labelledby="rg-summary"><h2 id="rg-summary">Summary</h2><dl><dt>Fault cases</dt><dd>${summary.cases} (${summary.verdicts.fail} fail, ${summary.verdicts.warn} warn, ${summary.verdicts.pass} pass)</dd><dt>Outcomes</dt><dd>${
		outcomes.length > 0
			? outcomes.map((o, i) => html`${i > 0 ? ", " : ""}${badge("o", o)} ${summary.outcomes[o]}`)
			: "none"
	}</dd>${
		summary.skippedCandidates > 0
			? html`<dt>Not run</dt><dd>${summary.skippedCandidates} candidate(s) not run (budget)</dd>`
			: ""
	}</dl>${
		report.baselineAnomalies.length > 0
			? html`<h3>Baseline anomalies</h3><ul class="rg-warnings">${report.baselineAnomalies.map((a) => html`<li>${a}</li>`)}</ul>`
			: ""
	}${summary.cases === 0 ? html`<p>No fault cases ran (baseline only).</p>` : ""}</section><section aria-labelledby="rg-legend"><h2 id="rg-legend">Legend</h2><ul class="rg-legend">${REPORT_OUTCOMES.map(
		(o) => html`<li>${badge("o", o)} ${OUTCOME_LEGEND[o]}</li>`,
	)}</ul><p class="rg-muted">Timeline bars: solid = applied, striped = deduplicated, outlined = failed, hatched = still in flight; dashed red lines = injected faults.</p></section><section class="rg-filters" aria-label="Filters"><label for="rg-verdict">Verdict</label><select id="rg-verdict"><option value="">All</option>${[
		"fail",
		"warn",
		"pass",
	].map(
		(v) => html`<option value="${v}">${v.toUpperCase()}</option>`,
	)}</select><label for="rg-outcome">Outcome</label><select id="rg-outcome"><option value="">All</option>${REPORT_OUTCOMES.map(
		(o) => html`<option value="${o}">${o}</option>`,
	)}</select><p id="rg-count" aria-live="polite">${report.cases.length} of ${report.cases.length} cases shown</p></section>${report.cases.map(caseSection)}</main>`;
}

/**
 * Renders a self-contained HTML report: inline timeline SVGs, filters and explanations, all
 * data escaped, a strict CSP with hashes, and no external references.
 *
 * @example
 * await writeFile("report.html", await renderHtml(report));
 */
export async function renderHtml(report: Report, options: HtmlOptions = {}): Promise<string> {
	const title =
		options.title ??
		`ReplayGuard: ${report.scenario.name} - ${report.summary.verdict.toUpperCase()}`;
	const csp = await contentSecurityPolicy(STYLES, FILTER_SCRIPT);
	const doc = html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>${title}</title>
<style>${raw(STYLES)}</style>
</head>
<body>
${body(report)}
<script type="application/json" id="rg-data">${raw(escapeJsonForScript(reportToJson(report)))}</script>
<script>${raw(FILTER_SCRIPT)}</script>
</body>
</html>
`;
	return doc.value;
}

/**
 * Writes the HTML report to `path`, creating parent directories. The library writes files only
 * when asked.
 *
 * @example
 * await writeHtmlReport(report, "reports/checkout.html");
 */
export async function writeHtmlReport(
	report: Report,
	path: string,
	options: HtmlOptions = {},
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, await renderHtml(report, options), "utf8");
}

/**
 * A reporter that renders HTML.
 *
 * @example
 * const doc = await htmlReporter().render(report);
 */
export function htmlReporter(options: HtmlOptions = {}): Reporter<string> {
	return { name: "html", render: (report) => renderHtml(report, options) };
}
