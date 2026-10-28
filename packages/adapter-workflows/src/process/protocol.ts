import { HarnessError } from "@replayguard/core";
import * as v from "valibot";

const Int = v.pipe(v.number(), v.integer(), v.minValue(0));
const Serialized = v.strictObject({
	name: v.string(),
	message: v.string(),
	code: v.exactOptional(v.string()),
});

const Outcome = v.variant("state", [
	v.strictObject({ state: v.literal("completed"), output: v.unknown() }),
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

/** Messages the parent (test process) sends to the child (workflow host). */
export type ParentMessage = v.InferOutput<typeof ParentMessageSchema>;
/** Messages the child sends to the parent. */
export type ChildMessage = v.InferOutput<typeof ChildMessageSchema>;

function parse<T>(schema: v.GenericSchema<unknown, T>, raw: unknown, side: string): T {
	const result = v.safeParse(schema, raw);
	if (!result.success)
		throw new HarnessError(`invalid IPC message from ${side}: ${result.issues[0]?.message}`);
	return result.output;
}

/**
 * Validates a message received by the child. Only plain data is accepted — never code.
 *
 * @example
 * const msg = parseParentMessage(raw);
 */
export function parseParentMessage(raw: unknown): ParentMessage {
	return parse(ParentMessageSchema, raw, "parent");
}

/**
 * Validates a message received by the parent.
 *
 * @example
 * const msg = parseChildMessage(raw);
 */
export function parseChildMessage(raw: unknown): ChildMessage {
	return parse(ChildMessageSchema, raw, "child");
}
