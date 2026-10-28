import type { SerializedError } from "../errors.js";

/** Lifecycle of one effect attempt: `started` → exactly one terminal status. */
export type AttemptStatus = "started" | "applied" | "deduplicated" | "failed";

/** Why a workflow run ended. */
export type RunEndReason =
	| "completed"
	| "failed"
	| "crashed"
	| "yielded"
	| "waiting"
	| "killed"
	| "budget"
	| "harness-error";

/** One invocation of an instrumented side-effect function. */
export interface EffectAttempt {
	/** Monotonic sequence number within the ledger, starting at 1. */
	readonly seq: number;
	/** Index of the run (simulated process lifetime) that made the call. */
	readonly runIndex: number;
	/** Effect kind, e.g. `payment.charge`. */
	readonly kind: string;
	/** What the effect acts on (custom subject or hash of the arguments). */
	readonly subject: string;
	/** Logical effect identity: `${kind}::${subject}`. */
	readonly identity: string;
	/** 1-based count of attempts of this kind in the ledger. */
	readonly kindOccurrence: number;
	/** 1-based count of attempts with this identity in the ledger. */
	readonly identityOccurrence: number;
	/** Idempotency key sent to the provider, if any. */
	readonly idempotencyKey: string | undefined;
	/** Clock time when the attempt started. */
	readonly startedAt: number;
	/** Clock time when the attempt settled; `undefined` while in flight. */
	settledAt: number | undefined;
	/** Current lifecycle status. */
	status: AttemptStatus;
	/** Serialized error when `status` is `failed`. */
	error: SerializedError | undefined;
	/** IDs of faults recorded while this attempt was in flight. */
	inFlightAtFaults: string[];
	/** Opt-in, user-redacted preview of the arguments (never stored by default). */
	preview: unknown;
}

/** A call about to start: what hooks see before an attempt exists. */
export interface PendingCall {
	/** Effect kind. */
	readonly kind: string;
	/** Effect subject. */
	readonly subject: string;
	/** Logical identity `${kind}::${subject}`. */
	readonly identity: string;
	/** Occurrence this call will have among attempts of its kind. */
	readonly kindOccurrence: number;
	/** Occurrence this call will have among attempts of its identity. */
	readonly identityOccurrence: number;
	/** Idempotency key the call will send, if any. */
	readonly idempotencyKey: string | undefined;
	/** Run the call happens in. */
	readonly runIndex: number;
}

/** One workflow run (process lifetime) inside a case. */
export interface RunRecord {
	/** 0-based index of the run within the case. */
	readonly runIndex: number;
	/** Clock time when the run began. */
	readonly startedAt: number;
	/** Clock time when the run ended; `undefined` while active. */
	endedAt: number | undefined;
	/** Why the run ended; `undefined` while active. */
	endReason: RunEndReason | undefined;
	/** Whether a crash fault killed this run (no further effects may start in it). */
	dead: boolean;
}

/** An injected fault and the attempts that were in flight at that moment. */
export interface FaultEvent {
	/** Fault ID, `F1`, `F2`, … in order of injection. */
	readonly id: string;
	/** 1-based sequence among faults. */
	readonly seq: number;
	/** Run in which the fault fired. */
	readonly runIndex: number;
	/** Clock time when the fault fired. */
	readonly at: number;
	/** Name of the fault strategy, e.g. `crash`. */
	readonly strategy: string;
	/** Human-readable anchor, e.g. `after payment.charge#1`. */
	readonly anchor: string;
	/** `seq` of attempts that were in flight when the fault fired. */
	readonly inFlight: readonly number[];
}

/** A run began. */
export interface RunStartedEvent {
	/** Event discriminator. */
	readonly type: "run-started";
	/** Copy of the run record at the time of the event. */
	readonly run: Readonly<RunRecord>;
}

/** A run ended. */
export interface RunEndedEvent {
	/** Event discriminator. */
	readonly type: "run-ended";
	/** Copy of the run record, including end time and reason. */
	readonly run: Readonly<RunRecord>;
}

/** An effect attempt started. */
export interface AttemptStartedEvent {
	/** Event discriminator. */
	readonly type: "attempt-started";
	/** Copy of the attempt at the time of the event. */
	readonly attempt: Readonly<EffectAttempt>;
}

/** An effect attempt settled. */
export interface AttemptSettledEvent {
	/** Event discriminator. */
	readonly type: "attempt-settled";
	/** Copy of the settled attempt. */
	readonly attempt: Readonly<EffectAttempt>;
}

/** A fault was injected. */
export interface FaultRecordedEvent {
	/** Event discriminator. */
	readonly type: "fault";
	/** The recorded fault. */
	readonly fault: FaultEvent;
}

/** Events delivered synchronously to ledger observers. */
export type LedgerEvent =
	| RunStartedEvent
	| RunEndedEvent
	| AttemptStartedEvent
	| AttemptSettledEvent
	| FaultRecordedEvent;

/** Immutable, JSON-serializable copy of a ledger. */
export interface LedgerSnapshot {
	/** Snapshot schema version. */
	readonly version: 1;
	/** All attempts in `seq` order. */
	readonly attempts: readonly Readonly<EffectAttempt>[];
	/** All recorded faults in order. */
	readonly faults: readonly FaultEvent[];
	/** All runs in order. */
	readonly runs: readonly Readonly<RunRecord>[];
	/** Whether the ledger was finalized (no further changes possible). */
	readonly finalized: boolean;
}

/**
 * Control-flow hooks used by fault strategies. Unlike observers, hooks may throw or await to
 * change what the instrumented call does.
 */
export interface EffectHooks {
	/** Before an attempt starts; throwing prevents the call (nothing is recorded). */
	beforeStart?(call: PendingCall): void | Promise<void>;
	/** After the attempt started, before the provider is invoked; awaiting simulates a hang. */
	inFlight?(attempt: Readonly<EffectAttempt>): void | Promise<void>;
	/** After the attempt settled; throwing replaces the call's result (lost response, crash). */
	afterSettle?(attempt: Readonly<EffectAttempt>): void | Promise<void>;
}
