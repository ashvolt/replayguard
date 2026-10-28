import { workflowsRuntime } from "@replayguard/adapter-workflows";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import * as facade from "../src/index.js";
import "../src/setup.js";
import { createFakePayment, fault, idempotencyKey, PACKAGE_NAME, scenario } from "../src/index.js";

describe("replayguard facade", () => {
	it("exposes its package name and re-exports core, fakes and matchers", () => {
		expect(PACKAGE_NAME).toBe("replayguard");
		for (const name of [
			"scenario",
			"fault",
			"classify",
			"buildReport",
			"idempotencyKey",
			"createFakePayment",
			"createFakeEmail",
			"replayGuardMatchers",
		]) {
			expect(facade).toHaveProperty(name);
		}
	});

	it("runs the README example", async () => {
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
	});
});
