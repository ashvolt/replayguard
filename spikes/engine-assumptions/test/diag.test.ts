import { loadMetadata, loadStorage, type WorkflowContextInterface } from "@rivet-dev/workflows";
import { expect, it } from "vitest";
import { CrashableDriver, FakeWorld, runUntilSettled } from "./harness.js";

it("diag: durable store after crash-in-step holds no step entry or attempt metadata", async () => {
	const driver = new CrashableDriver();
	const world = new FakeWorld();
	const wf = async (ctx: WorkflowContextInterface) =>
		ctx.step("charge", async () => {
			await world.effect("payment");
			driver.crash();
			return "ok";
		});

	const s = await runUntilSettled(driver, wf, { maxRuns: 1 });
	driver.restart();
	const storage = await loadStorage(driver);
	const entries = [...storage.history.entries.values()];
	const metas = await Promise.all(entries.map((e) => loadMetadata(storage, driver, e.id)));
	console.log({
		crashes: s.crashes,
		writesBeforeCrash: driver.writes,
		state: storage.state,
		entries: entries.length,
		metas,
	});
	expect(entries.length).toBe(0);
});
