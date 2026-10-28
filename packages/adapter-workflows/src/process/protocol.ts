import { HarnessError, type RunOutcome, type SerializedError } from "@replayguard/core";
import * as v from "valibot";

const Int = v.pipe(v.number(), v.integer(), v.minValue(0));
const Serialized = v.strictObject({
	name: v.string(),
	message: v.string(),
	code: v.exactOptional(v.string()),
});

const Outcome = v.variant("state", [
	// `output` may be absent: JSON IPC drops keys whose value is undefined.
	v.strictObject({ state: v.literal("completed"), output: v.exactOptional(v.unknown()) }),
	v.strictObject({ state: v.literal("failed"), error: Serialized }),
	v.strictObject({ state: v.literal("sleeping"), wakeAt: v.number() }),
	v.strictObject({ state: v.literal("waiting"), names: v.array(v.string()) }),
]);

const ParentMessageSchema = v.variant("type", [
	v.strictObject({
		type: v.literal("init"),
		caseIndex: Int,
		workflowId: v.string(),
		storeDir: v.string(),
		scenarioModule: v.string(),
		exportName: v.string(),
		input: v.exactOptional(v.unknown()),
	}),
	v.strictObject({ type: v.literal("continue"), token: Int, error: v.exactOptional(Serialized) }),
]);

const ChildMessageSchema = v.variant("type", [
	v.strictObject({
		type: v.literal("before-start"),
		token: Int,
		kind: v.string(),
		subject: v.string(),
		idempotencyKey: v.exactOptional(v.string()),
	}),
	v.strictObject({ type: v.literal("in-flight"), token: Int, call: Int, seq: Int }),
	v.strictObject({
		type: v.literal("after-settle"),
		token: Int,
		seq: Int,
		status: v.picklist(["applied", "deduplicated", "failed"]),
		error: v.exactOptional(Serialized),
	}),
	v.strictObject({ type: v.literal("run-ended"), outcome: Outcome }),
	v.strictObject({ type: v.literal("harness-error"), message: v.string() }),
]);

/** Parent → child: start a run. */
export interface InitMessage {
	/** Discriminator. */
	type: "init";
	/** Case index (0 = baseline). */
	caseIndex: number;
	/** Workflow ID. */
	workflowId: string;
	/** Durable store directory shared by all runs of the case. */
	storeDir: string;
	/** File URL of the scenario module. */
	scenarioModule: string;
	/** Export returning the built scenario. */
	exportName: string;
	/** JSON-serializable workflow input. */
	input?: unknown;
}

/** Parent → child: resume after a checkpoint, optionally throwing an error at the effect. */
export interface ContinueMessage {
	/** Discriminator. */
	type: "continue";
	/** Checkpoint token being answered. */
	token: number;
	/** Error to throw from the effect (e.g. lost response). */
	error?: SerializedError;
}

/** Messages the parent (test process) sends to the child (workflow host). */
export type ParentMessage = InitMessage | ContinueMessage;

/** Child → parent: an effect is about to start. */
export interface BeforeStartMessage {
	/** Discriminator. */
	type: "before-start";
	/** Checkpoint token. */
	token: number;
	/** Effect kind. */
	kind: string;
	/** Effect subject. */
	subject: string;
	/** Idempotency key, if any. */
	idempotencyKey?: string;
}

/** Child → parent: the effect started and is in flight. */
export interface InFlightMessage {
	/** Discriminator. */
	type: "in-flight";
	/** Checkpoint token. */
	token: number;
	/** Token of the matching before-start checkpoint. */
	call: number;
	/** Child-local attempt sequence number. */
	seq: number;
}

/** Child → parent: the effect settled. */
export interface AfterSettleMessage {
	/** Discriminator. */
	type: "after-settle";
	/** Checkpoint token. */
	token: number;
	/** Child-local attempt sequence number. */
	seq: number;
	/** Terminal status. */
	status: "applied" | "deduplicated" | "failed";
	/** Provider error when failed. */
	error?: SerializedError;
}

/** Child → parent: the run ended (never `crashed` — crashes are kills). */
export interface RunEndedMessage {
	/** Discriminator. */
	type: "run-ended";
	/** Outcome of the run. */
	outcome: Exclude<RunOutcome, { state: "crashed" }>;
}

/** Child → parent: the child host itself failed. */
export interface HarnessErrorMessage {
	/** Discriminator. */
	type: "harness-error";
	/** Failure details. */
	message: string;
}

/** Messages the child sends to the parent. */
export type ChildMessage =
	| BeforeStartMessage
	| InFlightMessage
	| AfterSettleMessage
	| RunEndedMessage
	| HarnessErrorMessage;

function parse<T>(schema: v.GenericSchema, raw: unknown, side: string): T {
	const result = v.safeParse(schema, raw);
	if (!result.success)
		throw new HarnessError(`invalid IPC message from ${side}: ${result.issues[0]?.message}`);
	return result.output as T;
}

/**
 * Validates a message received by the child. Only plain data is accepted — never code.
 *
 * @example
 * const msg = parseParentMessage(raw);
 */
export function parseParentMessage(raw: unknown): ParentMessage {
	return parse<ParentMessage>(ParentMessageSchema, raw, "parent");
}

/**
 * Validates a message received by the parent.
 *
 * @example
 * const msg = parseChildMessage(raw);
 */
export function parseChildMessage(raw: unknown): ChildMessage {
	return parse<ChildMessage>(ChildMessageSchema, raw, "child");
}
