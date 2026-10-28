import type { AttemptTimelineEvent, CaseReport } from "@replayguard/core";
import { html, type SafeHtml } from "./html.js";

const LABEL = 56;
const LANE = 26;
const BAR = 14;
const TOP = 6;
const MIN_BAR = 2;

const round = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function eventEnd(e: CaseReport["timeline"][number]): number {
	if (e.type === "fault") return e.at;
	return e.end ?? e.start;
}

function barFill(a: AttemptTimelineEvent, prefix: string): string | undefined {
	switch (a.status) {
		case "deduplicated":
			return `url(#${prefix}-dedup)`;
		case "started":
			return `url(#${prefix}-inflight)`;
		case "failed":
			return "none";
		default:
			return undefined;
	}
}

/**
 * Inline SVG timeline of one case: one lane per run, attempt bars by status (applied solid,
 * deduplicated striped, failed outlined, in flight hatched) and fault markers.
 *
 * @example
 * html`<figure>${renderTimeline(caseReport)}</figure>`;
 */
export function renderTimeline(c: CaseReport, options: { width?: number } = {}): SafeHtml {
	if (c.timeline.length === 0) return html`<p class="rg-muted">No timeline events.</p>`;
	const width = options.width ?? 720;
	const lanes = Math.max(...c.timeline.map((e) => e.runIndex)) + 1;
	const height = TOP * 2 + lanes * LANE;
	const total = Math.max(1, ...c.timeline.map(eventEnd));
	const x = (t: number) => round(LABEL + (t / total) * (width - LABEL - 8));
	const laneY = (run: number) => TOP + run * LANE;
	const prefix = `rg-p${c.index}`;
	const attempts = c.timeline.filter((e) => e.type === "attempt");
	const faults = c.timeline.filter((e) => e.type === "fault");
	const runs = c.timeline.filter((e) => e.type === "run");
	const titleId = `rg-tl-${c.index}`;

	return html`<svg class="rg-timeline" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${titleId}"><title id="${titleId}">Timeline of case ${c.index}: ${plural(lanes, "run")}, ${plural(attempts.length, "attempt")}, ${plural(faults.length, "fault")}</title><defs><pattern id="${prefix}-dedup" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="rg-pat-bg" width="6" height="6"/><rect class="rg-pat-fg" width="3" height="6"/></pattern><pattern id="${prefix}-inflight" width="6" height="6" patternUnits="userSpaceOnUse"><path class="rg-pat-line" d="M0 6L6 0"/></pattern></defs>${Array.from(
		{ length: lanes },
		(_, run) =>
			html`<g class="rg-lane"><text class="rg-lane-label" x="4" y="${laneY(run) + LANE / 2 + 4}">run ${run}</text><line class="rg-lane-sep" x1="0" x2="${width}" y1="${laneY(run) + LANE}" y2="${laneY(run) + LANE}"/></g>`,
	)}${runs.map(
		(r) =>
			html`<rect class="rg-run" x="${x(r.start)}" y="${laneY(r.runIndex) + 2}" width="${Math.max(MIN_BAR, round(x(r.end ?? total) - x(r.start)))}" height="${LANE - 4}"><title>run ${r.runIndex}: ${r.start}–${r.end ?? "?"} ms${r.endReason ? `, ${r.endReason}` : ""}</title></rect>`,
	)}${attempts.map((a) => {
		const fill = barFill(a, prefix);
		const end = a.end ?? total;
		const span = a.end === undefined ? `${a.start} ms – still in flight` : `${a.start}–${a.end} ms`;
		return html`<rect class="rg-bar rg-bar-${a.status}"${fill === undefined ? "" : html` fill="${fill}"`} x="${x(a.start)}" y="${laneY(a.runIndex) + (LANE - BAR) / 2}" width="${Math.max(MIN_BAR, round(x(end) - x(a.start)))}" height="${BAR}"><title>#${a.seq} ${a.kind} ${a.subject}: ${a.status}, ${span}</title></rect>`;
	})}${faults.map(
		(f) =>
			html`<g><line class="rg-fault" x1="${x(f.at)}" x2="${x(f.at)}" y1="${laneY(f.runIndex)}" y2="${laneY(f.runIndex) + LANE}"><title>${f.id} ${f.label} at ${f.at} ms</title></line><text class="rg-fault-label" x="${x(f.at) + 2}" y="${laneY(f.runIndex) + 9}">${f.id}</text></g>`,
	)}</svg>`;
}
