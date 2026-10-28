import type { CaseReport, EffectReport, Report, TimelineEvent } from "./model.js";

/** Visits a report; every hook is optional (Visitor pattern). */
export interface ReportVisitor<T> {
	/** Called once, first. */
	visitReport?(report: Report): void;
	/** Called per case, baseline first. */
	visitCase?(c: CaseReport, report: Report): void;
	/** Called per effect of the current case. */
	visitEffect?(e: EffectReport, c: CaseReport): void;
	/** Called per timeline event of the current case. */
	visitTimelineEvent?(e: TimelineEvent, c: CaseReport): void;
	/** The visitor's output. */
	result(): T;
}

/** An output format for reports. */
export interface Reporter<T = string> {
	/** Reporter name. */
	readonly name: string;
	/** Renders a report. */
	render(report: Report): T | Promise<T>;
}

/**
 * Walks a report in order: report → each case → its effects → its timeline.
 *
 * @example
 * const kinds = walkReport(report, { visitEffect: (e) => seen.add(e.kind), result: () => seen });
 */
export function walkReport<T>(report: Report, visitor: ReportVisitor<T>): T {
	visitor.visitReport?.(report);
	for (const c of report.cases) {
		visitor.visitCase?.(c, report);
		for (const e of c.effects) visitor.visitEffect?.(e, c);
		for (const e of c.timeline) visitor.visitTimelineEvent?.(e, c);
	}
	return visitor.result();
}
