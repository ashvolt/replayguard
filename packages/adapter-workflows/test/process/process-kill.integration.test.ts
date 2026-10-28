import { existsSync } from "node:fs";
import { fault, type ScenarioResult, scenario } from "@replayguard/core";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { beforeAll, describe, expect, it } from "vitest";
import { workflowsRuntime } from "../../src/runtime.js";

const entry = new URL("../../dist/process/child-entry.js", import.meta.url);

beforeAll(() => {
	if (!existsSync(entry))
		throw new Error("build the package first: pnpm --filter @replayguard/adapter-workflows build");
});

const applied = (r: ScenarioResult, i: number) =>
	r.cases[i]?.ledger.attempts.filter((a) => a.status === "applied").length;

describe("process kill with real child processes (US4)", { timeout: 30_000 }, () => {
	it("kills after the anchor, restarts on the same file store and matches in-process crash", async () => {
		const { scenarioFactory } = await import("../fixtures/checkout.scenario.mjs");
		const result: ScenarioResult = await scenarioFactory().run();
		expect(result.baseline).toMatchObject({
			status: "settled",
			final: { state: "completed", output: "ok" },
		});
		expect(result.cases[0]).toMatchObject({
			status: "settled",
			restarts: 1,
			final: { state: "completed", output: "ok" },
		});
		expect(applied(result, 0)).toBe(2);
		expect(result.cases[0]?.faultOutcomes[0]).toMatchObject({
			strategy: "processKill",
			triggered: true,
		});

		const inProcess = await scenario()
			.runtime(workflowsRuntime())
			.effects((ctx) => ({ charge: ctx.instrument(async () => "ok", { kind: "payment" }) }))
			.workflow(
				({ charge }) =>
					async (wf: WorkflowContextInterface) =>
						wf.step({
							name: "charge",
							retryBackoffBase: 1,
							retryBackoffMax: 1,
							run: () => charge(),
						}),
			)
			.case("crash", [fault.crashAfter("payment")])
			.build()
			.run();
		expect(result.cases[0]?.ledger.attempts.map((a) => a.status)).toEqual(
			inProcess.cases[0]?.ledger.attempts.map((a) => a.status),
		);
	});

	it("reports a fault that never triggers", async () => {
		const { scenarioFactory } = await import("../fixtures/checkout.scenario.mjs");
		const result: ScenarioResult = await scenarioFactory().run();
		expect(result.cases[1]).toMatchObject({ status: "settled", restarts: 0 });
		expect(result.cases[1]?.faultOutcomes[0]?.triggered).toBe(false);
	});

	it("bounds a hanging child by the case budget and kills it", async () => {
		const { hangingFactory } = await import("../fixtures/checkout.scenario.mjs");
		const start = Date.now();
		const result: ScenarioResult = await hangingFactory().run();
		expect(result.baseline.status).toBe("budget-exceeded");
		expect(Date.now() - start).toBeLessThan(10_000);
	});
});
