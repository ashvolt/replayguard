import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { expect, it } from "vitest";
import { CrashableDriver, EXPECT_GAP, runUntilSettled } from "./harness.js";

/**
 * A step with `maxRetries: 2` may run at most 3 times. If the process crashes while the step is
 * running, the attempt is not persisted before `run()`, so every restart starts again at
 * attempt 1: the step runs (and charges) without bound.
 */
it("bounds step executions by maxRetries even when the process crashes mid-step", async () => {
	const driver = new CrashableDriver();
	const maxRetries = 2;
	let executions = 0;
	let crashesLeft = 5;
	const wf = async (ctx: WorkflowContextInterface) =>
		ctx.step({
			name: "charge",
			maxRetries,
			run: async () => {
				executions++; // stands in for an external, non-idempotent call
				if (crashesLeft-- > 0) driver.crash();
				return "ok";
			},
		});

	const settled = await runUntilSettled(driver, wf);
	expect(settled.crashes).toBeGreaterThan(0);

	if (EXPECT_GAP) {
		// Observed on @rivet-dev/workflows 1.0.0: 6 executions, workflow completes.
		expect(executions).toBe(6);
		expect(settled.result?.state).toBe("completed");
	} else {
		// Expected: at most maxRetries + 1 executions, then the step is exhausted.
		expect(executions).toBeLessThanOrEqual(maxRetries + 1);
	}
});
