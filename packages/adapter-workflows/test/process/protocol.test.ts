import { HarnessError } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { parseChildMessage, parseParentMessage } from "../../src/process/protocol.js";

describe("IPC protocol", () => {
	it.each([
		{
			type: "init",
			caseIndex: 1,
			workflowId: "wf",
			storeDir: "/tmp/x",
			scenarioModule: "file:///a.mjs",
			exportName: "scenarioFactory",
			input: { a: 1 },
		},
		{ type: "continue", token: 3 },
		{
			type: "continue",
			token: 3,
			error: { name: "SimulatedNetworkError", message: "x", code: "ECONNRESET" },
		},
	])("accepts parent message %o", (msg) => {
		expect(parseParentMessage(msg)).toEqual(msg);
	});

	it.each([
		{ type: "before-start", token: 1, kind: "payment", subject: "o-1" },
		{ type: "before-start", token: 1, kind: "payment", subject: "o-1", idempotencyKey: "k" },
		{ type: "in-flight", token: 2, call: 1, seq: 1 },
		{ type: "after-settle", token: 3, seq: 1, status: "applied" },
		{
			type: "after-settle",
			token: 3,
			seq: 1,
			status: "failed",
			error: { name: "Error", message: "x" },
		},
		{ type: "run-ended", outcome: { state: "completed", output: { any: ["json"] } } },
		{ type: "run-ended", outcome: { state: "sleeping", wakeAt: 5 } },
		{ type: "run-ended", outcome: { state: "waiting", names: [] } },
		{ type: "run-ended", outcome: { state: "failed", error: { name: "E", message: "m" } } },
		{ type: "harness-error", message: "boom" },
	])("accepts child message %o", (msg) => {
		expect(parseChildMessage(msg)).toEqual(msg);
	});

	it.each([
		null,
		"text",
		{ type: "eval", code: "process.exit()" },
		{ type: "continue", token: "1" },
		{ type: "after-settle", token: 1, seq: 1, status: "started" },
		{ type: "run-ended", outcome: { state: "crashed" } },
		{ type: "before-start", token: 1, kind: "p" },
	])("rejects %o", (msg) => {
		expect(() => parseChildMessage(msg)).toThrow(HarnessError);
		expect(() => parseParentMessage(msg)).toThrow(HarnessError);
	});
});
