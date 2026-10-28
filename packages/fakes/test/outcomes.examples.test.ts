import { workflowsRuntime } from "@replayguard/adapter-workflows";
import { classify, type FaultSpec, fault, type Outcome, scenario } from "@replayguard/core";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { createFakeEmail } from "../src/email.js";
import { createFakePayment } from "../src/payment.js";
import { createFakeWebhookReceiver } from "../src/webhook.js";

type Step = Parameters<WorkflowContextInterface["step"]>[0];
const fast = { retryBackoffBase: 1, retryBackoffMax: 1 } as const;

/** One-step checkout: charge with the fake payment provider, then email a receipt. */
function checkout(options: { key?: boolean; charge?: Partial<Step & object> }) {
	return scenario()
		.name("checkout")
		.runtime(workflowsRuntime())
		.effects((ctx) => ({ payment: createFakePayment(ctx), email: createFakeEmail(ctx) }))
		.workflow(({ payment, email }) => async (wf: WorkflowContextInterface) => {
			await wf.step({
				name: "charge",
				...fast,
				...options.charge,
				run: () =>
					payment.charge({
						orderId: "o-1",
						amount: 500,
						...(options.key ? { idempotencyKey: `${wf.workflowId}:charge` } : {}),
					}),
			} as Step);
			await wf.step({
				name: "receipt",
				...fast,
				run: () => email.send({ to: "a@example.com", template: "receipt" }),
			});
			return "done";
		})
		.budget({ graceMs: 150 });
}

async function outcomes(
	build: ReturnType<typeof checkout>,
	faults: FaultSpec[],
): Promise<Record<string, Outcome>> {
	const classified = classify(await build.case("case", faults).build().run());
	return Object.fromEntries(
		(classified.cases[1]?.effects ?? []).map((e) => [e.kind, e.outcome]),
	) as Record<string, Outcome>;
}

describe("every outcome class with the fakes (T014)", () => {
	it("exactly-once: nothing goes wrong", async () => {
		const classified = classify(await checkout({}).build().run());
		expect(classified.cases[0]?.effects.map((e) => e.outcome)).toEqual([
			"exactly-once",
			"exactly-once",
		]);
	});

	it("duplicated: crash after the charge without an idempotency key", async () => {
		expect(await outcomes(checkout({}), [fault.crashAfter("payment.charge")])).toEqual({
			"payment.charge": "duplicated",
			"email.send": "exactly-once",
		});
	});

	it("duplicated: the email sender never deduplicates a lost response", async () => {
		expect(await outcomes(checkout({}), [fault.loseResponse("email.send")])).toMatchObject({
			"email.send": "duplicated",
		});
	});

	it("deduplicated: the same crash with a stable idempotency key", async () => {
		expect(
			await outcomes(checkout({ key: true }), [fault.crashAfter("payment.charge")]),
		).toMatchObject({ "payment.charge": "deduplicated" });
	});

	it("concurrent-duplicate: provider hangs past a retried step timeout", async () => {
		const build = checkout({ charge: { timeout: 20, retryOnTimeout: true, maxRetries: 1 } });
		expect(await outcomes(build, [fault.delay("payment.charge", 80)])).toMatchObject({
			"payment.charge": "concurrent-duplicate",
		});
	});

	it("orphaned: provider hangs past a critical step timeout and the workflow fails", async () => {
		const build = checkout({ charge: { timeout: 20 } });
		expect(await outcomes(build, [fault.delay("payment.charge", 60)])).toEqual({
			"payment.charge": "orphaned",
		});
	});

	it("skipped: a lost request is swallowed by the workflow", async () => {
		const build = scenario()
			.name("notify")
			.runtime(workflowsRuntime())
			.effects((ctx) => ({ receiver: createFakeWebhookReceiver(ctx) }))
			.workflow(({ receiver }) => async (wf: WorkflowContextInterface) => {
				await wf.step("notify", async () => {
					try {
						await receiver.deliver({ id: "evt_1", type: "order.paid", payload: {} });
					} catch {
						// best effort — the bug under test
					}
				});
			})
			.budget({ graceMs: 5 });
		const classified = classify(
			await build
				.case("lost", [fault.loseRequest("webhook.deliver")])
				.build()
				.run(),
		);
		expect(classified.cases[1]?.effects.map((e) => e.outcome)).toEqual(["skipped"]);
	});
});
