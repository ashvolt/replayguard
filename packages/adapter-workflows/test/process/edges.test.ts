import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileDriver } from "../../src/file-driver.js";
import { defaultChildDeps, runChildHost } from "../../src/process/child-host.js";
import { forkChild, workflowsProcessRuntime } from "../../src/process/process-runtime.js";
import { toOutcome } from "../../src/runtime.js";

describe("process edges", () => {
	it("forkChild exchanges messages with a real child and reports exit and kill", async () => {
		const dir = mkdtempSync(join(tmpdir(), "rg-fork-"));
		const echo = join(dir, "echo.mjs");
		writeFileSync(
			echo,
			"process.on('message', (m) => { process.send({ echo: m }); if (m.last) process.exit(3); });\n",
		);
		const child = forkChild(echo);
		const messages: unknown[] = [];
		const exited = new Promise<number | null>((resolve) => child.onExit(resolve));
		child.onMessage((m) => messages.push(m));
		child.send({ type: "continue", token: 1 });
		await new Promise((r) => setTimeout(r, 300));
		child.send({ type: "continue", token: 2, last: true } as never);
		expect(await exited).toBe(3);
		expect(messages).toEqual([
			{ echo: { type: "continue", token: 1 } },
			{ echo: { type: "continue", token: 2, last: true } },
		]);
		child.send({ type: "continue", token: 3 });

		const hang = join(dir, "hang.mjs");
		writeFileSync(hang, "setInterval(() => {}, 1000);\n");
		const sleeper = forkChild(hang);
		const killed = new Promise<number | null>((resolve) => sleeper.onExit(resolve));
		sleeper.kill();
		expect(await killed).toBeNull();
	});

	it("default child deps import modules and open file stores", async () => {
		const mod = await defaultChildDeps.importModule("node:path");
		expect(typeof mod["join"]).toBe("function");
		expect(
			await defaultChildDeps.openDriver(mkdtempSync(join(tmpdir(), "rg-dep-"))),
		).toBeInstanceOf(FileDriver);
	});

	it("child host revives replied errors with and without codes and reports bad init", async () => {
		const sent: unknown[] = [];
		let deliver: (raw: unknown) => void = () => undefined;
		const io = {
			async send(m: unknown) {
				sent.push(m);
				const msg = m as { type: string; token?: number };
				if (msg.type === "before-start") {
					queueMicrotask(() =>
						deliver({
							type: "continue",
							token: msg.token,
							error:
								msg.token === 1
									? { name: "Net", message: "lost", code: "ECONNRESET" }
									: { name: "Plain", message: "nope" },
						}),
					);
				} else if (msg.token !== undefined)
					queueMicrotask(() => deliver({ type: "continue", token: msg.token }));
			},
			onMessage(listener: (raw: unknown) => void) {
				deliver = listener;
			},
		};
		const caught: unknown[] = [];
		const built = {
			definition: {
				effects: (ctx: {
					instrument: (fn: () => Promise<number>, o: { kind: string }) => () => Promise<number>;
				}) => ({
					fx: ctx.instrument(async () => 1, { kind: "k" }),
				}),
				workflow:
					({ fx }: { fx: () => Promise<number> }) =>
					async () => {
						for (let i = 0; i < 2; i++) await fx().catch((e: unknown) => caught.push(e));
						return "done";
					},
			},
		};
		const done = runChildHost(io, {
			importModule: async () => ({ scenarioFactory: () => built }),
			openDriver: (d) => FileDriver.open(d),
		});
		deliver({
			type: "init",
			caseIndex: 0,
			workflowId: "wf",
			storeDir: mkdtempSync(join(tmpdir(), "rg-host-")),
			scenarioModule: "x",
			exportName: "scenarioFactory",
		});
		await done;
		expect(caught.map((e) => [(e as Error).name, (e as { code?: string }).code])).toEqual([
			["Net", "ECONNRESET"],
			["Plain", undefined],
		]);
		expect(sent.at(-1)).toEqual({
			type: "run-ended",
			outcome: { state: "completed", output: "done" },
		});

		const bad: unknown[] = [];
		let push: (raw: unknown) => void = () => undefined;
		const p = runChildHost({
			async send(m) {
				bad.push(m);
			},
			onMessage(l) {
				push = l;
			},
		});
		push({ type: "nonsense" });
		await p;
		expect((bad[0] as { type: string }).type).toBe("harness-error");
	});

	it("maps unexpected engine states to failed", () => {
		expect(toOutcome({ state: "cancelled" })).toEqual({
			state: "failed",
			error: { name: "WorkflowNotCompleted", message: 'workflow ended in state "cancelled"' },
		});
	});

	it("defaults the child entry to the bundled file and exposes a no-op write listener", async () => {
		const entries: string[] = [];
		const rt = workflowsProcessRuntime({
			scenarioModule: import.meta.url,
			spawn: (entry) => {
				entries.push(entry);
				return {
					send: () => undefined,
					onMessage: () => undefined,
					onExit: (l) => queueMicrotask(() => l(0)),
					kill: () => undefined,
				};
			},
		});
		const c = await rt.prepareCase({
			workflowId: "w",
			input: undefined,
			caseIndex: 0,
			ledger: undefined as never,
			effectContext: undefined as never,
			build: () => undefined as never,
			faults: [],
		});
		c.persistence.onBeforeWrite(() => undefined)();
		expect(c.persistence.writeCount).toBe(0);
		await expect(c.runOnce(0)).rejects.toThrow(/exited/);
		expect(entries[0]?.replaceAll("\\", "/")).toMatch(/process\/child-entry\.js$/);
		await c.dispose();
	});
});

describe("process edges: protocol robustness", () => {
	const crafted = (messages: (init: { storeDir: string }) => unknown[]) =>
		workflowsProcessRuntime({
			scenarioModule: import.meta.url,
			spawn: () => {
				let listener: (raw: unknown) => void = () => undefined;
				return {
					send: (m) => {
						if (m.type === "init")
							for (const msg of messages(m)) queueMicrotask(() => listener(msg));
					},
					onMessage: (l) => {
						listener = l;
					},
					onExit: () => undefined,
					kill: () => undefined,
				};
			},
		});
	const prepare = (rt: ReturnType<typeof crafted>) =>
		rt.prepareCase({
			workflowId: "w",
			input: undefined,
			caseIndex: 0,
			ledger: new (class {
				hooks = () => [];
				pendingCall = () => ({});
			})() as never,
			effectContext: undefined as never,
			build: () => undefined as never,
			faults: [],
		});

	it("rejects in-flight checkpoints for unknown calls and unknown attempts", async () => {
		const unknownCall = await prepare(
			crafted(() => [{ type: "in-flight", token: 2, call: 99, seq: 1 }]),
		);
		await expect(unknownCall.runOnce(0)).rejects.toThrow("unknown call token 99");
		const unknownSeq = await prepare(
			crafted(() => [{ type: "after-settle", token: 2, seq: 5, status: "applied" }]),
		);
		await expect(unknownSeq.runOnce(0)).rejects.toThrow("unknown attempt 5");
	});

	it("ignores messages after the run ended", async () => {
		const c = await prepare(
			crafted(() => [
				{ type: "run-ended", outcome: { state: "completed", output: 1 } },
				{ type: "run-ended", outcome: { state: "completed", output: 2 } },
			]),
		);
		await expect(c.runOnce(0)).resolves.toEqual({ state: "completed", output: 1 });
	});

	it("maps sleeping without a wake time to an immediate wake", () => {
		const before = Date.now();
		const outcome = toOutcome({ state: "sleeping" });
		expect(outcome.state).toBe("sleeping");
		expect(outcome.state === "sleeping" && outcome.wakeAt).toBeGreaterThanOrEqual(before);
	});

	it("stores and reloads the empty key", async () => {
		const d = mkdtempSync(join(tmpdir(), "rg-empty-"));
		await (await FileDriver.open(d)).set(new Uint8Array(), new Uint8Array([1]));
		expect(await (await FileDriver.open(d)).get(new Uint8Array())).toEqual(new Uint8Array([1]));
	});
});
