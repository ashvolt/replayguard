import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	ConfigError,
	type FaultSpec,
	fault,
	type ScenarioResult,
	scenario,
} from "@replayguard/core";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { FileDriver } from "../../src/file-driver.js";
import type { ChildChannel, SpawnChild } from "../../src/process/process-runtime.js";
import { workflowsProcessRuntime } from "../../src/process/process-runtime.js";
import { workflowsRuntime } from "../../src/runtime.js";
import { inMemorySpawn } from "./in-memory-spawn.js";

const thisModule = import.meta.url;

function checkoutOn(runtime: ReturnType<typeof workflowsRuntime>, faults: FaultSpec[]) {
	return scenario()
		.runtime(runtime)
		.effects((ctx) => ({
			charge: ctx.instrument(async () => "ok", {
				kind: "payment",
				idempotencyKey: () => "wf:charge",
			}),
		}))
		.workflow(
			({ charge }) =>
				async (wf: WorkflowContextInterface) =>
					wf.step({ name: "charge", retryBackoffBase: 1, retryBackoffMax: 1, run: () => charge() }),
		)
		.case("faulted", faults)
		.budget({ graceMs: 5 })
		.build();
}

/** Process runtime whose child rebuilds the same scenario via the in-memory module import. */
function processSetup(faults: FaultSpec[]) {
	let built: ReturnType<typeof checkoutOn> | undefined;
	const spawn = inMemorySpawn({
		importModule: async () => ({ scenarioFactory: () => built }),
		openDriver: (dir) => FileDriver.open(dir),
	});
	const runtime = workflowsProcessRuntime({ scenarioModule: thisModule, spawn });
	built = checkoutOn(runtime, faults);
	return { scenario: built, spawn };
}

const summary = (r: ScenarioResult) =>
	r.cases.map((c) => ({
		status: c.status,
		restarts: c.restarts,
		final: c.final,
		attempts: c.ledger.attempts.map((a) => a.status),
		triggered: c.faultOutcomes.map((o) => o.triggered),
	}));

describe("process runtime (in-memory child)", () => {
	it("crash-style faults kill the child and restart on the same store (parity with in-process)", async () => {
		const { scenario: s, spawn } = processSetup([fault.killAfter("payment")]);
		const proc = await s.run();
		const inProc = await checkoutOn(workflowsRuntime(), [fault.crashAfter("payment")]).run();
		expect(summary(proc)).toEqual(summary(inProc));
		expect(proc.cases[0]).toMatchObject({
			restarts: 1,
			final: { state: "completed", output: "ok" },
		});
		expect(proc.cases[0]?.ledger.faults[0]?.strategy).toBe("processKill");
		expect(spawn.spawned).toBe(3);
	});

	it("supports crash, lost response and delay through checkpoints", async () => {
		const crash = await processSetup([fault.crashAfter("payment")]).scenario.run();
		expect(crash.cases[0]?.restarts).toBe(1);
		const lost = await processSetup([fault.loseResponse("payment")]).scenario.run();
		expect(lost.cases[0]).toMatchObject({ restarts: 0, final: { state: "completed" } });
		expect(lost.cases[0]?.ledger.attempts.map((a) => a.status)).toEqual(["applied", "applied"]);
		const request = await processSetup([fault.loseRequest("payment")]).scenario.run();
		expect(request.cases[0]?.ledger.attempts.map((a) => a.status)).toEqual(["applied"]);
		const delayed = await processSetup([fault.delay("payment", 30)]).scenario.run();
		const [attempt] = delayed.cases[0]?.ledger.attempts ?? [];
		expect((attempt?.settledAt ?? 0) - (attempt?.startedAt ?? 0)).toBeGreaterThanOrEqual(25);
	});

	it("relays provider errors and idempotency keys across the process boundary", async () => {
		let built: unknown;
		const spawn = inMemorySpawn({
			importModule: async () => ({ scenarioFactory: () => built }),
			openDriver: (dir) => FileDriver.open(dir),
		});
		let n = 0;
		const relayed = scenario()
			.runtime(workflowsProcessRuntime({ scenarioModule: thisModule, spawn }))
			.effects((ctx) => ({
				flaky: ctx.instrument(
					async () => {
						if (n++ === 0) throw new Error("declined");
						return "ok";
					},
					{ kind: "payment" },
				),
			}))
			.workflow(
				({ flaky }) =>
					async (wf: WorkflowContextInterface) =>
						wf.step({ name: "pay", retryBackoffBase: 1, retryBackoffMax: 1, run: () => flaky() }),
			)
			.budget({ graceMs: 5 })
			.build();
		built = relayed;
		const r = await relayed.run();
		expect(r.baseline.ledger.attempts.map((a) => [a.status, a.error?.message])).toEqual([
			["failed", "declined"],
			["applied", undefined],
		]);
		const keyed = await processSetup([]).scenario.run();
		expect(keyed.baseline.ledger.attempts[0]?.idempotencyKey).toBe("wf:charge");
	});

	it("reports untriggered faults", async () => {
		const r = await processSetup([fault.killAfter("payment", 2)]).scenario.run();
		expect(r.cases[0]).toMatchObject({ status: "settled", restarts: 0 });
		expect(r.cases[0]?.faultOutcomes[0]?.triggered).toBe(false);
	});

	it("rejects durable-write anchors and modules outside the project root", async () => {
		const bad = processSetup([fault.crashAtWrite(1)]).scenario;
		const r = await bad.run();
		expect(r.cases[0]?.status).toBe("harness-error");
		expect(r.cases[0]?.harnessError?.message).toContain("durable-write anchors are not supported");
		const outside = workflowsProcessRuntime({
			scenarioModule: thisModule,
			projectRoot: mkdtempSync(join(tmpdir(), "rg-root-")),
		});
		await expect(
			outside.prepareCase({
				workflowId: "w",
				input: undefined,
				caseIndex: 0,
				ledger: undefined as never,
				effectContext: undefined as never,
				build: () => undefined as never,
				faults: [],
			}),
		).rejects.toThrow(ConfigError);
		const missing = workflowsProcessRuntime({ scenarioModule: join(tmpdir(), "nope-404.mjs") });
		await expect(
			missing.prepareCase({
				workflowId: "w",
				input: undefined,
				caseIndex: 0,
				ledger: undefined as never,
				effectContext: undefined as never,
				build: () => undefined as never,
				faults: [],
			}),
		).rejects.toThrow(/scenario module not found/);
	});

	it("turns child failures into harness errors", async () => {
		const noExport = workflowsProcessRuntime({
			scenarioModule: thisModule,
			spawn: inMemorySpawn({
				importModule: async () => ({}),
				openDriver: (d) => FileDriver.open(d),
			}),
		});
		const r1 = await checkoutOn(noExport, []).run();
		expect(r1.baseline.status).toBe("harness-error");
		expect(r1.baseline.harnessError?.message).toContain(
			'does not export a function "scenarioFactory"',
		);

		const notScenario = workflowsProcessRuntime({
			scenarioModule: thisModule,
			spawn: inMemorySpawn({
				importModule: async () => ({ scenarioFactory: () => ({}) }),
				openDriver: (d) => FileDriver.open(d),
			}),
		});
		expect((await checkoutOn(notScenario, []).run()).baseline.harnessError?.message).toContain(
			"must return a built scenario",
		);

		const exits: SpawnChild = () => {
			const exit: ((code: number | null) => void)[] = [];
			const channel: ChildChannel = {
				send: () =>
					queueMicrotask(() => {
						for (const l of exit) l(7);
					}),
				onMessage: () => undefined,
				onExit: (l) => exit.push(l),
				kill: () => undefined,
			};
			return channel;
		};
		const r3 = await checkoutOn(
			workflowsProcessRuntime({ scenarioModule: thisModule, spawn: exits }),
			[],
		).run();
		expect(r3.baseline.harnessError?.message).toContain("child process exited (code 7)");

		const garbage: SpawnChild = () => {
			let listener: (raw: unknown) => void = () => undefined;
			return {
				send: () => queueMicrotask(() => listener({ type: "eval" })),
				onMessage: (l) => {
					listener = l;
				},
				onExit: () => undefined,
				kill: () => undefined,
			};
		};
		const r4 = await checkoutOn(
			workflowsProcessRuntime({ scenarioModule: thisModule, spawn: garbage }),
			[],
		).run();
		expect(r4.baseline.harnessError?.message).toContain("invalid IPC message from child");
	});

	it("disposes storage after each case", async () => {
		const dirs: string[] = [];
		const { scenario: s } = processSetup([]);
		const orig = FileDriver.open;
		FileDriver.open = async (dir: string) => {
			dirs.push(dir);
			return orig(dir);
		};
		try {
			await s.run();
		} finally {
			FileDriver.open = orig;
		}
		expect(dirs.length).toBeGreaterThan(0);
		for (const d of dirs) expect(existsSync(d)).toBe(false);
	});

	it("declares process isolation and the processKill strategy", () => {
		const rt = workflowsProcessRuntime({ scenarioModule: thisModule });
		expect(rt.processIsolated).toBe(true);
		expect(rt.strategies?.map((s) => s.name)).toEqual([
			"none",
			"crash",
			"throwAfter",
			"delay",
			"processKill",
		]);
	});
});
