import { Loop, type WorkflowContextInterface } from "@rivet-dev/workflows";
import { expect, it } from "vitest";
import { CrashableDriver, EXPECT_GAP, runUntilSettled } from "./harness.js";

/**
 * Idempotency keys must be stable across re-executions and unique per step execution. Inside a
 * step, the only public identity is `ctx.workflowId`; the engine's own location (step name plus
 * loop iteration) is not exposed. Two iterations of the same loop step therefore derive the same
 * key from public context, and a provider that deduplicates by key silently drops the second,
 * legitimate request.
 */
it("lets each step execution derive a distinct, stable key from public context", async () => {
	const keysByIteration = new Map<number, Set<string>>();
	let crashed = false;
	const driver = new CrashableDriver();
	const wf = async (ctx: WorkflowContextInterface) =>
		ctx.loop({
			name: "notify",
			state: 0,
			run: async (loopCtx, i) => {
				await loopCtx.step("send", async () => {
					// Best key available from public context today:
					const key = `${loopCtx.workflowId}:send`;
					const seen = keysByIteration.get(i) ?? new Set<string>();
					seen.add(key);
					keysByIteration.set(i, seen);
					if (i === 1 && !crashed) {
						crashed = true;
						driver.crash(); // re-execution must reproduce the same key
					}
				});
				return i < 1 ? Loop.continue(i + 1) : Loop.break(undefined);
			},
		});

	const settled = await runUntilSettled(driver, wf);
	expect(settled.result?.state).toBe("completed");
	expect(settled.crashes).toBe(1);
	// Stable: a re-executed iteration derives one key.
	for (const keys of keysByIteration.values()) expect(keys.size).toBe(1);

	const [first] = keysByIteration.get(0) ?? [];
	const [second] = keysByIteration.get(1) ?? [];
	if (EXPECT_GAP) {
		// Observed on 1.0.0: both iterations derive "wf-1:send".
		expect(first).toBe(second);
	} else {
		expect(first).not.toBe(second);
	}
});
