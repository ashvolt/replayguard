import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWorkflow, type WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { FileDriver } from "../src/file-driver.js";
import { driverConformance } from "./driver-conformance.js";

const key = (s: string) => new TextEncoder().encode(s);
const dir = () => mkdtempSync(join(tmpdir(), "rg-file-"));

driverConformance("FileDriver", () => FileDriver.open(dir()));

describe("FileDriver", () => {
	it("persists data and alarms across reopen", async () => {
		const d = dir();
		const a = await FileDriver.open(d);
		await a.set(key("k"), key("v"));
		await a.batch([{ key: key("x"), value: new Uint8Array([0, 255]) }]);
		await a.setAlarm("wf", 123);
		const b = await FileDriver.open(d);
		expect(await b.get(key("k"))).toEqual(key("v"));
		expect(await b.get(key("x"))).toEqual(new Uint8Array([0, 255]));
		expect(b.getAlarm("wf")).toBe(123);
		await b.delete(key("k"));
		await b.deletePrefix(key("x"));
		await b.deleteRange(key("a"), key("z"));
		await b.clearAlarm("wf");
		const c = await FileDriver.open(d);
		expect(c.keys()).toEqual([]);
		expect(c.getAlarm("wf")).toBeUndefined();
	});

	it("writes atomically through a temp file and leaves no temp behind", async () => {
		const d = dir();
		const driver = await FileDriver.open(d);
		await driver.set(key("k"), key("v"));
		expect(readdirSync(d)).toEqual(["kv.json"]);
		const data = JSON.parse(readFileSync(join(d, "kv.json"), "utf8"));
		expect(data).toEqual({ version: 1, kv: { "6b": "dg==" }, alarms: {} });
	});

	it("starts empty when no file exists and rejects unknown file versions", async () => {
		const d = dir();
		expect((await FileDriver.open(d)).keys()).toEqual([]);
		expect(existsSync(join(d, "kv.json"))).toBe(false);
		writeFileSync(join(d, "kv.json"), JSON.stringify({ version: 9, kv: {}, alarms: {} }));
		await expect(FileDriver.open(d)).rejects.toThrow("unsupported kv.json version 9");
	});

	it("runs a workflow that resumes from the file after a fresh open", async () => {
		const d = dir();
		let calls = 0;
		const wf = async (ctx: WorkflowContextInterface) => {
			await ctx.step("once", async () => ++calls);
			return calls;
		};
		await runWorkflow("wf", wf, undefined, await FileDriver.open(d), { mode: "yield" }).result;
		const second = await runWorkflow("wf", wf, undefined, await FileDriver.open(d), {
			mode: "yield",
		}).result;
		expect(second.state).toBe("completed");
		expect(calls).toBe(1);
	});
});
