import { scenario } from "@replayguard/core";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { workflowsRuntime } from "../src/runtime.js";

describe("performance (SC-002)", () => {
	it("explores a 5-effect workflow (20 cases) in under 5 s", async () => {
		const start = performance.now();
		const result = await scenario()
			.runtime(workflowsRuntime())
			.effects((ctx) => ({
				fx: ctx.instrument(async (i: number) => i, { kind: "effect", subject: (i) => String(i) }),
			}))
			.workflow(({ fx }) => async (wf: WorkflowContextInterface) => {
				for (let i = 0; i < 5; i++) {
					await wf.step({
						name: `s${i}`,
						retryBackoffBase: 1,
						retryBackoffMax: 1,
						run: () => fx(i),
					});
				}
			})
			.explore({ maxCases: 500 })
			.budget({ graceMs: 0 })
			.build()
			.run();
		expect(result.cases).toHaveLength(20);
		expect(performance.now() - start).toBeLessThan(5_000);
	});
});
