import type {
	AttemptStatus,
	CaseResult,
	EffectAttempt,
	RunOutcome,
	ScenarioResult,
} from "@replayguard/core";

interface A {
	kind?: string;
	subject?: string;
	status?: AttemptStatus;
	start?: number;
	end?: number;
	key?: string;
}

function attempts(list: readonly A[]): EffectAttempt[] {
	return list.map((a, i) => {
		const kind = a.kind ?? "payment.charge";
		const subject = a.subject ?? "o-1";
		const start = a.start ?? i * 10;
		return {
			seq: i + 1,
			runIndex: 0,
			kind,
			subject,
			identity: `${kind}::${subject}`,
			kindOccurrence: 1,
			identityOccurrence: 1,
			idempotencyKey: a.key,
			startedAt: start,
			settledAt: a.end ?? start + 1,
			status: a.status ?? "applied",
			error: undefined,
			inFlightAtFaults: [],
			preview: undefined,
		};
	});
}

/** A case with the given attempts. */
export function caseOf(
	index: number,
	name: string,
	list: readonly A[],
	final: RunOutcome = { state: "completed", output: null },
): CaseResult {
	return {
		index,
		name,
		origin: index === 0 ? "baseline" : "explicit",
		faults: [],
		faultOutcomes: [],
		status: "settled",
		final,
		runs: 1,
		restarts: 0,
		durationMs: 1,
		ledger: { version: 1, attempts: attempts(list), faults: [], runs: [], finalized: true },
		harnessError: undefined,
	};
}

/** A scenario result from a baseline and cases. */
export function resultOf(baseline: CaseResult, cases: CaseResult[]): ScenarioResult {
	return {
		version: 1,
		scenario: { name: "checkout", runtime: "fake", workflowId: "wf", seed: 1 },
		baseline,
		cases,
		skipped: [],
		baselineClean: true,
		startedAt: 0,
		durationMs: 1,
	};
}

const baselineAttempts: A[] = [{}, { kind: "email.send", subject: "a@example.com" }];

/** Payment charged twice after a crash; email sent once. */
export function duplicatedPayment(): ScenarioResult {
	return resultOf(caseOf(0, "baseline", baselineAttempts), [
		caseOf(1, "crash after charge", [{}, {}, { kind: "email.send", subject: "a@example.com" }]),
	]);
}

/** Payment replay deduplicated by the provider; email duplicated. */
export function dedupedPaymentDuplicatedEmail(): ScenarioResult {
	return resultOf(caseOf(0, "baseline", baselineAttempts), [
		caseOf(1, "lost response", [
			{ key: "k" },
			{ key: "k", status: "deduplicated" },
			{ kind: "email.send", subject: "a@example.com" },
			{ kind: "email.send", subject: "a@example.com" },
		]),
	]);
}

/** Charge applied, then the workflow failed. */
export function orphanedPayment(): ScenarioResult {
	return resultOf(caseOf(0, "baseline", baselineAttempts), [
		caseOf(1, "slow provider", [{}], {
			state: "failed",
			error: { name: "StepFailedError", message: "timeout" },
		}),
	]);
}

/** Everything exactly once. */
export function clean(): ScenarioResult {
	return resultOf(caseOf(0, "baseline", baselineAttempts), [
		caseOf(1, "crash before charge", baselineAttempts),
	]);
}
