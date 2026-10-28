import { existsSync } from "node:fs";
import { sep } from "node:path";
import { ConfigError, fault, scenario } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { actorWorkflow } from "../src/actor-workflow.js";
import { REPLAYGUARD_ACTOR } from "../src/host/actor-host.js";
import { rivetkitRuntime } from "../src/runtime.js";
import { fakeActorEngine, inMemoryActorSpawn } from "./support/fake-actor.js";

type StepCtx = { step(name: string, run: () => Promise<unknown>): Promise<unknown> };

function setup() {
	const engine = fakeActorEngine();
	let built: unknown;
	const killed: string[] = [];
	const spawn = inMemoryActorSpawn({
		importModule: async () => ({ scenarioFactory: () => built }),
		launch: engine.launch,
	});
	const runtime = rivetkitRuntime({
		scenarioModule: import.meta.url,
		spawn,
		enginePort: 7999,
		killEngine: (dir) => killed.push(dir),
	});
	const checkout = (faults = [fault.crashAfter("payment")]) => {
		const s = scenario()
			.name("actor-checkout")
			.runtime(runtime)
			.effects((ctx) => ({
				charge: ctx.instrument(async () => "charged", { kind: "payment", subject: () => "o-1" }),
			}))
			.workflow(({ charge }) =>
				actorWorkflow(async (ctx) => {
					await (ctx as unknown as StepCtx).step("charge", () => charge());
					return "done";
				}),
			)
			.input({ orderId: "o-1" })
			.case("crash after charge", faults)
			.build();
		built = s;
		return s;
	};
	return { engine, spawn, killed, checkout, runtime };
}

describe("rivetkitRuntime (in-memory host)", () => {
	it("describes itself as process-isolated with processKill", () => {
		const { runtime } = setup();
		expect(runtime.name).toBe("rivetkit (actor)");
		expect(runtime.processIsolated).toBe(true);
		expect(runtime.strategies?.map((s) => s.name)).toContain("processKill");
	});

	it("runs the baseline, kills the host at the anchor and resumes on a new host", async () => {
		const { engine, spawn, killed, checkout } = setup();
		const classified = await checkout().run({ classify: true });
		const [crash] = classified.result.cases;
		expect(classified.result.baseline.final).toEqual({ state: "completed", output: "done" });
		expect(crash).toMatchObject({
			restarts: 1,
			runs: 2,
			final: { state: "completed", output: "done" },
		});
		expect(classified.cases[1]?.effects[0]?.outcome).toBe("duplicated");
		expect(spawn.spawned).toBe(3);
		expect(engine.launches[0]).toMatchObject({
			actorName: REPLAYGUARD_ACTOR,
			key: ["replayguard-wf"],
			enginePort: 7999,
			input: { orderId: "o-1" },
		});
		// One storage directory per case; both runs of the crash case share it.
		const dirs = engine.launches.map((l) => l.storageDir);
		expect(new Set(dirs).size).toBe(2);
		expect(dirs[1]).toBe(dirs[2]);
		expect(killed).toEqual([...new Set(dirs)]);
		for (const dir of dirs) expect(existsSync(dir)).toBe(false);
	});

	it("rejects durable-write anchors", async () => {
		const { checkout } = setup();
		const result = await checkout([fault.crashAtWrite(1)]).run();
		expect(result.cases[0]).toMatchObject({ status: "harness-error" });
		expect(result.cases[0]?.harnessError?.message).toBe(
			"durable-write anchors are not supported by the RivetKit runtime",
		);
		expect(new ConfigError("x")).toBeInstanceOf(Error);
	});

	it("removes the storage directory even if stopping the engine fails", async () => {
		const engine = fakeActorEngine();
		let built: unknown;
		const runtime = rivetkitRuntime({
			scenarioModule: import.meta.url,
			spawn: inMemoryActorSpawn({
				importModule: async () => ({ scenarioFactory: () => built }),
				launch: engine.launch,
			}),
			enginePort: 7999,
			killEngine: () => {
				throw new Error("cannot kill engine");
			},
		});
		built = scenario()
			.runtime(runtime)
			.effects(() => ({}))
			.workflow(() => actorWorkflow(async () => "ok"))
			.build();
		const result = await (built as { run(): Promise<{ baseline: { status: string } }> }).run();
		// The core runner ignores dispose errors; the directory must still be gone.
		expect(result.baseline.status).toBe("settled");
		for (const l of engine.launches) expect(existsSync(l.storageDir)).toBe(false);
	});
});

describe("rivetkitRuntime defaults", () => {
	it("finds a free engine port, uses the bundled host entry and the real engine killer", async () => {
		const engine = fakeActorEngine();
		const entries: string[] = [];
		let built: unknown;
		const spawn = inMemoryActorSpawn({
			importModule: async () => ({ scenarioFactory: () => built }),
			launch: engine.launch,
		});
		const runtime = rivetkitRuntime({
			scenarioModule: import.meta.url,
			spawn: (entry) => {
				entries.push(entry);
				return spawn(entry);
			},
		});
		const s = scenario()
			.runtime(runtime)
			.effects(() => ({}))
			.workflow(() => actorWorkflow(async () => "ok"))
			.build();
		built = s;
		const result = await s.run();
		expect(result.baseline.final).toEqual({ state: "completed", output: "ok" });
		expect(entries[0]?.split(sep).join("/")).toMatch(/\/host\/host-entry\.js$/);
		expect(engine.launches[0]?.enginePort).toBeGreaterThanOrEqual(7420);
	});

	it("exposes crash controls without durable-write hooks", async () => {
		const runtime = rivetkitRuntime({ scenarioModule: import.meta.url, enginePort: 7999 });
		const c = await runtime.prepareCase({
			workflowId: "wf",
			input: undefined,
			caseIndex: 0,
			ledger: undefined as never,
			effectContext: undefined as never,
			build: undefined as never,
			faults: [],
		} as never);
		expect(c.persistence.crashed).toBe(false);
		expect(c.persistence.writeCount).toBe(0);
		c.persistence.crash();
		expect(c.persistence.crashed).toBe(true);
		c.persistence.restart();
		expect(c.persistence.crashed).toBe(false);
		const unsubscribe = c.persistence.onBeforeWrite(() => undefined);
		expect(unsubscribe()).toBeUndefined();
		await c.dispose();
	});
});
