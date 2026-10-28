import { type EffectContext, scenario } from "@replayguard/core";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { workflowsRuntime } from "../src/runtime.js";
import {
	type CheckoutShape,
	CONFORMANCE_GRACE_MS,
	type ConformanceCase,
	runtimeConformanceSuite,
} from "../test-support/conformance.js";

const fast = { retryBackoffBase: 1, retryBackoffMax: 1 } as const;

/** The conformance "checkout" effects: a payment provider that dedups by key, and email. */
export function checkoutEffects(ctx: EffectContext) {
	const seen = new Set<string>();
	return {
		charge: ctx.instrument(
			async (_orderId: string, key: string | undefined) => {
				const replayed = key !== undefined && seen.has(key);
				if (key !== undefined) seen.add(key);
				return { replayed };
			},
			{
				kind: "payment",
				subject: (orderId: string) => orderId,
				idempotencyKey: (_orderId, key) => key,
				isDeduplicated: (res) => res.replayed,
			},
		),
		email: ctx.instrument(async (_to: string) => "sent", {
			kind: "email",
			subject: (to: string) => to,
		}),
	};
}

function checkout(shape: CheckoutShape) {
	return scenario()
		.name("conformance-checkout")
		.runtime(workflowsRuntime())
		.effects(checkoutEffects)
		.workflow(({ charge, email }) => async (wf: WorkflowContextInterface) => {
			const receipt = (ephemeral: boolean) =>
				wf.step({ name: "receipt", ephemeral, ...fast, run: () => email("a@example.com") });
			if (shape.ephemeralReceiptFirst) await receipt(true);
			await wf.step({
				name: "charge",
				...fast,
				...shape.charge,
				run: () => charge("o-1", shape.key ? `${wf.workflowId}:charge` : undefined),
			});
			if (!shape.ephemeralReceiptFirst) await receipt(false);
		})
		.budget({ graceMs: CONFORMANCE_GRACE_MS });
}

runtimeConformanceSuite("workflowsRuntime (in-process engine)", (c: ConformanceCase) =>
	checkout(c.shape).case(c.name, c.faults).build(),
);
