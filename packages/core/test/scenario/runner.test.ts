import { describe, expect, it } from "vitest";
import { CrashSignal } from "../../src/errors.js";
import { fault } from "../../src/faults/types.js";
import { manualClock } from "../../src/ports/clock.js";
import { systemSleeper } from "../../src/ports/sleeper.js";
import { scenario } from "../../src/scenario/builder.js";
import { type FakeWorkflow, fakeRuntime, instantSleeper } from "../support/fake-runtime.js";

function deterministic() {
	const clock = manualClock(1_000);
	return { clock, sleeper: instantSleeper(clock) };
}

describe("ScenarioRunner lifecycle (US1)", () => {
	it("runs the baseline first, then explicit cases, each with a ledger and run counts", async () => {
		const runtime = fakeRuntime();
		const result = await scenario()
			.name("checkout")
			.runtime(runtime)
			.effects((ctx) => ({ charge: ctx.instrument(async () => "ok", { kind: "payment" }) }))
			.workflow(
				({ charge }): FakeWorkflow =>
					async () => {
						await charge();
						return undefined;
					},
			)
			.case("crash after charge", [fault.crashAfter("payment")])
			.build()
			.run(deterministic());

		expect(result.version).toBe(1);
		expect(result.scenario).toEqual({
			name: "checkout",
			runtime: "fake",
			workflowId: "replayguard-wf",
			seed: 1,
		});
		expect(result.baseline).toMatchObject({
			index: 0,
			name: "baseline",
			origin: "baseline",
			status: "settled",
			runs: 1,
			restarts: 0,
		});
		expect(result.baseline.final).toEqual({ state: "completed", output: 0 });
		expect(result.baselineClean).toBe(true);
		const [crash] = result.cases;
		expect(crash).toMatchObject({
			index: 1,
			name: "crash after charge",
			origin: "explicit",
			status: "settled",
			runs: 2,
			restarts: 1,
		});
		expect(crash?.faultOutcomes[0]).toMatchObject({ strategy: "crash", triggered: true });
		expect(crash?.ledger.attempts.filter((a) => a.status === "applied")).toHaveLength(2);
		expect(crash?.ledger.runs.map((r) => r.endReason)).toEqual(["crashed", "completed"]);
		expect(crash?.ledger.finalized).toBe(true);
		expect(runtime.prepared).toBe(2);
	});

	it("waits for scheduled retries like a host and resumes", async () => {
		const det = deterministic();
		const result = await scenario()
			.runtime(fakeRuntime())
			.effects(() => ({}))
			.workflow(
				(): FakeWorkflow =>
					async ({ runIndex }) =>
						runIndex < 2 ? { state: "sleeping", wakeAt: det.clock.now() + 250 } : undefined,
			)
			.build()
			.run(det);
		expect(result.baseline).toMatchObject({ status: "settled", runs: 3, restarts: 0 });
		expect(det.sleeper.slept).toEqual([250, 250, 25]);
		expect(result.baseline.ledger.runs.map((r) => r.endReason)).toEqual([
			"yielded",
			"yielded",
			"completed",
		]);
	});

	it("settles waiting workflows and delivers scripted messages", async () => {
		const runtime = fakeRuntime();
		const result = await scenario()
			.runtime(runtime)
			.effects(() => ({}))
			.workflow(
				(): FakeWorkflow =>
					async ({ delivered }) =>
						delivered.includes("approve") ? undefined : { state: "waiting", names: ["approve"] },
			)
			.deliver("approve", { ok: true })
			.build()
			.run(deterministic());
		expect(result.baseline.final).toEqual({ state: "completed", output: 1 });
		expect(runtime.delivered[0]).toEqual(["approve"]);

		const stuck = await scenario()
			.runtime(fakeRuntime())
			.effects(() => ({}))
			.workflow((): FakeWorkflow => async () => ({ state: "waiting", names: ["approve"] }))
			.build()
			.run(deterministic());
		expect(stuck.baseline.final).toEqual({ state: "waiting", names: ["approve"] });
		expect(stuck.baseline.ledger.runs[0]?.endReason).toBe("waiting");
	});

	it("reports failed workflows", async () => {
		const result = await scenario()
			.runtime(fakeRuntime())
			.effects(() => ({}))
			.workflow(
				(): FakeWorkflow => async () => {
					throw new Error("StepExhaustedError");
				},
			)
			.build()
			.run(deterministic());
		expect(result.baseline.final).toEqual({
			state: "failed",
			error: { name: "Error", message: "StepExhaustedError" },
		});
		expect(result.baselineClean).toBe(false);
	});

	it("stops at the run budget", async () => {
		const result = await scenario()
			.runtime(fakeRuntime())
			.effects(() => ({}))
			.workflow(
				(): FakeWorkflow => async () => {
					throw new CrashSignal("always");
				},
			)
			.budget({ maxRuns: 3 })
			.build()
			.run(deterministic());
		expect(result.baseline).toMatchObject({ status: "budget-exceeded", runs: 3, restarts: 3 });
		expect(result.baseline.final).toBeUndefined();
	});

	it("stops at the time budget and refuses late effects", async () => {
		const effects: string[] = [];
		const start = performance.now();
		const result = await scenario()
			.runtime(fakeRuntime())
			.effects((ctx) => ({
				late: ctx.instrument(async () => effects.push("late"), { kind: "late" }),
			}))
			.workflow(
				({ late }): FakeWorkflow =>
					async () => {
						await systemSleeper.sleep(120);
						await late().catch(() => effects.push("refused"));
						return undefined;
					},
			)
			.budget({ caseTimeoutMs: 40, graceMs: 150 })
			.build()
			.run();
		expect(performance.now() - start).toBeLessThan(1_000);
		expect(result.baseline.status).toBe("budget-exceeded");
		expect(result.baseline.ledger.runs[0]).toMatchObject({ endReason: "budget", dead: true });
		expect(effects).toEqual(["refused"]);
	});

	it("waits the grace period so late completions are recorded", async () => {
		const result = await scenario()
			.runtime(fakeRuntime())
			.effects((ctx) => ({ slow: ctx.instrument(() => systemSleeper.sleep(30), { kind: "slow" }) }))
			.workflow(
				({ slow }): FakeWorkflow =>
					async () => {
						void slow();
						return undefined;
					},
			)
			.budget({ graceMs: 80 })
			.build()
			.run();
		expect(result.baseline.ledger.attempts[0]?.status).toBe("applied");
	});

	it("isolates harness errors per case", async () => {
		const result = await scenario()
			.runtime(fakeRuntime({ failPrepare: (i) => i === 1 }))
			.effects(() => ({}))
			.workflow((): FakeWorkflow => async () => undefined)
			.case("broken", [fault.none()])
			.case("fine", [fault.none()])
			.build()
			.run(deterministic());
		expect(result.cases.map((c) => [c.name, c.status])).toEqual([
			["broken", "harness-error"],
			["fine", "settled"],
		]);
		expect(result.cases[0]?.harnessError).toEqual({
			name: "Error",
			message: "cannot prepare case 1",
		});
		expect(result.cases[0]?.ledger.attempts).toEqual([]);
	});

	it("records durations and total time", async () => {
		const det = deterministic();
		const result = await scenario()
			.runtime(fakeRuntime())
			.effects(() => ({}))
			.workflow(
				(): FakeWorkflow => async () => ({ state: "sleeping", wakeAt: det.clock.now() + 100 }),
			)
			.budget({ maxRuns: 2, graceMs: 0 })
			.build()
			.run(det);
		expect(result.startedAt).toBe(1_000);
		expect(result.baseline.durationMs).toBe(200);
		expect(result.durationMs).toBe(200);
	});
});
