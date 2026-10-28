import {
	type CaseReport,
	REPORT_OUTCOMES,
	type Report,
	type ReportVisitor,
	type VerdictLevel,
	walkReport,
} from "@replayguard/core";
import { type Palette, palette } from "./color.js";
import { renderTable } from "./table.js";

/** Console rendering options. */
export interface ConsoleOptions {
	/** Include the baseline and a details section with explanations, hints and warnings. */
	verbose?: boolean;
	/** Emit ANSI colors (default false). */
	color?: boolean;
	/** Use ASCII separators instead of box drawing. */
	ascii?: boolean;
}

const HEADERS = ["Case", "Effect", "Outcome", "Verdict", "Explanation"];

function verdictText(p: Palette, verdict: VerdictLevel, text: string): string {
	if (verdict === "fail") return p.bold(p.red(text));
	return verdict === "warn" ? p.yellow(text) : p.green(text);
}

function summaryLine(report: Report): string {
	const { summary } = report;
	const outcomes = REPORT_OUTCOMES.filter((o) => summary.outcomes[o] > 0)
		.map((o) => `${o} ${summary.outcomes[o]}`)
		.join(", ");
	const parts = [
		`${summary.cases} fault case${summary.cases === 1 ? "" : "s"}: ${summary.verdicts.fail} fail, ${summary.verdicts.warn} warn, ${summary.verdicts.pass} pass`,
		...(outcomes ? [outcomes] : []),
		...(summary.skippedCandidates > 0
			? [`${summary.skippedCandidates} candidate(s) not run (budget)`]
			: []),
	];
	return parts.join(" | ");
}

function details(c: CaseReport, p: Palette): string[] {
	const lines: string[] = [];
	for (const e of c.effects.filter((e) => e.verdict !== "pass")) {
		lines.push(
			`  ${e.identity}  ${e.outcome}  ${verdictText(p, e.verdict, e.verdict.toUpperCase())}`,
		);
		lines.push(`    ${e.explanation}`);
		for (const h of e.hints) {
			lines.push(`    ${p.bold("hint")} ${h.id}: ${h.title}`);
			lines.push(...h.example.split("\n").map((l) => `      ${p.dim(l)}`));
		}
	}
	for (const w of c.warnings) lines.push(`  ${p.yellow("warning")} ${w}`);
	if (lines.length === 0) return [];
	const faults = c.faults.length > 0 ? ` (${c.faults.join(", ")})` : "";
	return [`[${c.index}] ${c.name}${faults}`, ...lines];
}

function consoleVisitor(options: ConsoleOptions): ReportVisitor<string> {
	const p = palette(options.color === true);
	const rows: { cells: string[]; verdict: VerdictLevel }[] = [];
	const detailLines: string[] = [];
	let report: Report | undefined;
	let warnings = 0;
	return {
		visitReport: (r) => {
			report = r;
		},
		visitCase: (c) => {
			if (c.origin === "baseline" && !options.verbose) return;
			warnings += c.warnings.length;
			if (options.verbose) detailLines.push(...details(c, p));
			if (c.effects.length === 0) {
				rows.push({
					cells: [c.name, "-", "-", c.verdict.toUpperCase(), c.warnings[0] ?? "no effects"],
					verdict: c.verdict,
				});
			}
			for (const e of c.effects) {
				rows.push({
					cells: [c.name, e.identity, e.outcome, e.verdict.toUpperCase(), e.explanation],
					verdict: e.verdict,
				});
			}
		},
		result: () => {
			const r = report as Report;
			const { scenario, summary } = r;
			const out = [
				`ReplayGuard: ${p.bold(scenario.name)} (${scenario.runtime}, seed ${scenario.seed}) - ${verdictText(p, summary.verdict, summary.verdict.toUpperCase())}`,
				summaryLine(r),
				"",
			];
			if (summary.cases === 0 && !options.verbose) {
				out.push("No fault cases ran (baseline only).");
			} else {
				out.push(
					renderTable(
						HEADERS,
						rows.map((row) => row.cells),
						{
							...(options.ascii ? { ascii: true } : {}),
							style: (text, row, col) => {
								if (row < 0) return p.bold(text);
								const verdict = (rows[row] as (typeof rows)[number]).verdict;
								return col === 2 || col === 3 ? verdictText(p, verdict, text) : text;
							},
						},
					),
				);
			}
			for (const a of r.baselineAnomalies) out.push(`${p.yellow("!")} baseline: ${a}`);
			if (options.verbose && detailLines.length > 0)
				out.push("", p.bold("Details"), ...detailLines);
			if (!options.verbose && warnings > 0) {
				out.push(p.dim(`${warnings} warning(s); run with verbose for explanations and hints`));
			}
			return `${out.join("\n")}\n`;
		},
	};
}

/**
 * Renders a report as a console table (pure: same report and options, same string).
 *
 * @example
 * console.log(renderConsole(report, { verbose: true }));
 */
export function renderConsole(report: Report, options: ConsoleOptions = {}): string {
	return walkReport(report, consoleVisitor(options));
}
