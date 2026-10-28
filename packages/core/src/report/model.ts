import * as v from "valibot";
import type { Outcome, VerdictLevel } from "../classifier/types.js";
import type { FixHint } from "../hints/fix-hint.js";
import type { AttemptStatus, RunEndReason } from "../ledger/types.js";
import type { CaseOrigin, CaseStatus, ScenarioIdentity } from "../scenario/result.js";

/** Counts across the fault cases (the baseline is the reference and is not counted). */
export interface ReportSummary {
	/** Number of fault cases. */
	cases: number;
	/** Worst verdict overall. */
	verdict: VerdictLevel;
	/** Effects per outcome. */
	outcomes: Record<Outcome, number>;
	/** Cases per verdict. */
	verdicts: Record<VerdictLevel, number>;
	/** Explored candidates not run (budget). */
	skippedCandidates: number;
}

/** One logical effect in a case. */
export interface EffectReport {
	/** Logical identity `kind::subject`. */
	identity: string;
	/** Effect kind. */
	kind: string;
	/** Effect subject. */
	subject: string;
	/** Outcome. */
	outcome: Outcome;
	/** Verdict. */
	verdict: VerdictLevel;
	/** Applied attempts. */
	applied: number;
	/** Deduplicated attempts. */
	deduplicated: number;
	/** Failed attempts. */
	failed: number;
	/** Expected count from the baseline. */
	expected: number;
	/** Causal explanation. */
	explanation: string;
	/** Fix hints. */
	hints: FixHint[];
}

/** A run lane (times in ms relative to case start). */
export interface RunTimelineEvent {
	/** Discriminator. */
	type: "run";
	/** Run index. */
	runIndex: number;
	/** Start. */
	start: number;
	/** End (absent while active). */
	end?: number;
	/** Why the run ended. */
	endReason?: RunEndReason;
}

/** An effect attempt bar. */
export interface AttemptTimelineEvent {
	/** Discriminator. */
	type: "attempt";
	/** Attempt seq. */
	seq: number;
	/** Run index. */
	runIndex: number;
	/** Effect kind. */
	kind: string;
	/** Effect subject. */
	subject: string;
	/** Start. */
	start: number;
	/** End (absent while in flight). */
	end?: number;
	/** Status. */
	status: AttemptStatus;
}

/** An injected fault marker. */
export interface FaultTimelineEvent {
	/** Discriminator. */
	type: "fault";
	/** Fault ID. */
	id: string;
	/** Run index. */
	runIndex: number;
	/** Time. */
	at: number;
	/** Human-readable label. */
	label: string;
}

/** Something drawn on a case timeline. */
export type TimelineEvent = RunTimelineEvent | AttemptTimelineEvent | FaultTimelineEvent;

/** One case of the report. */
export interface CaseReport {
	/** Case index (0 = baseline). */
	index: number;
	/** Case name. */
	name: string;
	/** Where the case came from. */
	origin: CaseOrigin;
	/** Human-readable faults. */
	faults: string[];
	/** How the case ended. */
	status: CaseStatus;
	/** Final workflow state (`unsettled` when none). */
	finalState: string;
	/** Runs. */
	runs: number;
	/** Restarts. */
	restarts: number;
	/** Duration. */
	durationMs: number;
	/** Case verdict. */
	verdict: VerdictLevel;
	/** Effects. */
	effects: EffectReport[];
	/** Timeline: runs, then attempts, then faults. */
	timeline: TimelineEvent[];
	/** Warnings. */
	warnings: string[];
}

/** Serializable report (schema version 1). */
export interface Report {
	/** Schema version. */
	version: 1;
	/** ISO time of generation (injected clock). */
	generatedAt: string;
	/** Scenario identity. */
	scenario: ScenarioIdentity;
	/** Summary. */
	summary: ReportSummary;
	/** Oddities in the baseline. */
	baselineAnomalies: string[];
	/** Baseline first, then every case. */
	cases: CaseReport[];
}

const OUTCOMES = [
	"exactly-once",
	"deduplicated",
	"duplicated",
	"concurrent-duplicate",
	"orphaned",
	"skipped",
] as const satisfies readonly Outcome[];
const VERDICTS = ["pass", "warn", "fail"] as const satisfies readonly VerdictLevel[];
const count = v.pipe(v.number(), v.integer(), v.minValue(0));
const time = v.pipe(v.number(), v.finite());
const strings = v.array(v.string());

const Hint = v.strictObject({
	id: v.string(),
	title: v.string(),
	explanation: v.string(),
	example: v.string(),
});

const Effect = v.strictObject({
	identity: v.string(),
	kind: v.string(),
	subject: v.string(),
	outcome: v.picklist(OUTCOMES),
	verdict: v.picklist(VERDICTS),
	applied: count,
	deduplicated: count,
	failed: count,
	expected: count,
	explanation: v.string(),
	hints: v.array(Hint),
});

const Event = v.variant("type", [
	v.strictObject({
		type: v.literal("run"),
		runIndex: count,
		start: time,
		end: v.exactOptional(time),
		endReason: v.exactOptional(
			v.picklist([
				"completed",
				"failed",
				"crashed",
				"yielded",
				"waiting",
				"killed",
				"budget",
				"harness-error",
			] as const satisfies readonly RunEndReason[]),
		),
	}),
	v.strictObject({
		type: v.literal("attempt"),
		seq: count,
		runIndex: count,
		kind: v.string(),
		subject: v.string(),
		start: time,
		end: v.exactOptional(time),
		status: v.picklist([
			"started",
			"applied",
			"deduplicated",
			"failed",
		] as const satisfies readonly AttemptStatus[]),
	}),
	v.strictObject({
		type: v.literal("fault"),
		id: v.string(),
		runIndex: count,
		at: time,
		label: v.string(),
	}),
]);

const Case = v.strictObject({
	index: count,
	name: v.string(),
	origin: v.picklist(["baseline", "explicit", "explored"] as const satisfies readonly CaseOrigin[]),
	faults: strings,
	status: v.picklist([
		"settled",
		"budget-exceeded",
		"harness-error",
	] as const satisfies readonly CaseStatus[]),
	finalState: v.string(),
	runs: count,
	restarts: count,
	durationMs: time,
	verdict: v.picklist(VERDICTS),
	effects: v.array(Effect),
	timeline: v.array(Event),
	warnings: strings,
});

const schema = v.strictObject({
	version: v.literal(1),
	generatedAt: v.string(),
	scenario: v.strictObject({
		name: v.string(),
		runtime: v.string(),
		workflowId: v.string(),
		seed: v.number(),
	}),
	summary: v.strictObject({
		cases: count,
		verdict: v.picklist(VERDICTS),
		outcomes: v.strictObject(
			Object.fromEntries(OUTCOMES.map((o) => [o, count])) as Record<Outcome, typeof count>,
		),
		verdicts: v.strictObject({ pass: count, warn: count, fail: count }),
		skippedCandidates: count,
	}),
	baselineAnomalies: strings,
	cases: v.array(Case),
});

// Compile-time check that the schema and the interfaces agree.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const schemaMatches: Equal<v.InferOutput<typeof schema>, Report> = true;
void schemaMatches;

/** Valibot schema of a version-1 report. */
export const ReportSchema: v.GenericSchema<unknown, Report> = schema;

/** Outcome names in a stable order. */
export const REPORT_OUTCOMES: readonly Outcome[] = OUTCOMES;
