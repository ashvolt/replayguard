import type { CaseClassification, ClassifiedResult, Outcome } from "../classifier/types.js";
import { describeFault } from "../faults/types.js";
import { type Clock, systemClock } from "../ports/clock.js";
import type { CaseResult } from "../scenario/result.js";
import { type CaseReport, REPORT_OUTCOMES, type Report, type TimelineEvent } from "./model.js";

function timeline(c: CaseResult): TimelineEvent[] {
	const { runs, attempts, faults } = c.ledger;
	const origin = runs[0]?.startedAt ?? attempts[0]?.startedAt ?? 0;
	const rel = (t: number) => t - origin;
	return [
		...runs.map(
			(r): TimelineEvent => ({
				type: "run",
				runIndex: r.runIndex,
				start: rel(r.startedAt),
				...(r.endedAt === undefined ? {} : { end: rel(r.endedAt) }),
				...(r.endReason === undefined ? {} : { endReason: r.endReason }),
			}),
		),
		...attempts.map(
			(a): TimelineEvent => ({
				type: "attempt",
				seq: a.seq,
				runIndex: a.runIndex,
				kind: a.kind,
				subject: a.subject,
				start: rel(a.startedAt),
				...(a.settledAt === undefined ? {} : { end: rel(a.settledAt) }),
				status: a.status,
			}),
		),
		...faults.map(
			(f): TimelineEvent => ({
				type: "fault",
				id: f.id,
				runIndex: f.runIndex,
				at: rel(f.at),
				label: `${f.strategy} ${f.anchor}`,
			}),
		),
	];
}

function caseReport(c: CaseResult, classification: CaseClassification): CaseReport {
	return {
		index: c.index,
		name: c.name,
		origin: c.origin,
		faults: c.faults.map(describeFault),
		status: c.status,
		finalState: c.final?.state ?? "unsettled",
		runs: c.runs,
		restarts: c.restarts,
		durationMs: c.durationMs,
		verdict: classification.verdict,
		effects: classification.effects.map((e) => ({
			identity: e.identity,
			kind: e.kind,
			subject: e.subject,
			outcome: e.outcome,
			verdict: e.verdict,
			applied: e.evidence.applied,
			deduplicated: e.evidence.deduplicated,
			failed: e.evidence.failed,
			expected: e.evidence.expected,
			explanation: e.explanation,
			hints: e.hints.map((h) => ({ ...h })),
		})),
		timeline: timeline(c),
		warnings: [...classification.warnings],
	};
}

/**
 * Builds the serializable report (schema version 1) from a classified result.
 *
 * @example
 * const report = buildReport(classify(await checkout.run()));
 */
export function buildReport(classified: ClassifiedResult, options: { clock?: Clock } = {}): Report {
	const { result } = classified;
	const raw = [result.baseline, ...result.cases];
	const cases = classified.cases.map((c) =>
		caseReport(raw.find((r) => r.index === c.caseIndex) as CaseResult, c),
	);
	const faultCases = classified.cases.filter((c) => c.caseIndex !== result.baseline.index);
	const outcomes = Object.fromEntries(REPORT_OUTCOMES.map((o) => [o, 0])) as Record<
		Outcome,
		number
	>;
	const verdicts = { pass: 0, warn: 0, fail: 0 };
	for (const c of faultCases) {
		verdicts[c.verdict]++;
		for (const e of c.effects) outcomes[e.outcome]++;
	}
	return {
		version: 1,
		generatedAt: new Date((options.clock ?? systemClock).now()).toISOString(),
		scenario: { ...result.scenario },
		summary: {
			cases: faultCases.length,
			verdict: classified.verdict,
			outcomes,
			verdicts,
			skippedCandidates: result.skipped.length,
		},
		baselineAnomalies: [...classified.baselineAnomalies],
		cases,
	};
}
