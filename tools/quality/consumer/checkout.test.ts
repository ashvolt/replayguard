import { workflowsRuntime } from "@replayguard/adapter-workflows";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { createFakePayment, fault, idempotencyKey, scenario } from "replayguard";
import { expect, it } from "vitest";

it("charges once under crashes", async () => {
	const result = await scenario()
		.runtime(workflowsRuntime())
		.effects((ctx) => ({ payment: createFakePayment(ctx) }))
		.workflow(
			({ payment }) =>
				async (wf: WorkflowContextInterface) =>
					wf.step("charge", () =>
						payment.charge({
							orderId: "o-1",
							amount: 500,
							idempotencyKey: idempotencyKey(wf, "charge"),
						}),
					),
		)
		.case("crash after charge", [fault.crashAfter("payment.charge")])
		.explore()
		.build()
		.run({ classify: true });
	expect(result).toPassSideEffectPolicy();
	expect(result).toBeEffectivelyOnce("payment");
	// @ts-expect-error — not an outcome
	expect(result).not.toHaveOutcome("payment", "dupe");
});
