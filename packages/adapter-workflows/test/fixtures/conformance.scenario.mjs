// Conformance scenarios for the process runtime, loaded by real child processes. Mirrors
// test/conformance.engine.test.ts; one export per conformance case (case0 … case5).
import { workflowsProcessRuntime } from "@replayguard/adapter-workflows";
import { scenario } from "@replayguard/core";
import {
	CONFORMANCE_CASES as CASES,
	CONFORMANCE_GRACE_MS,
	externalKeyStore,
} from "../../test-support/conformance-cases.mjs";

const fast = { retryBackoffBase: 1, retryBackoffMax: 1 };

function checkoutEffects(ctx, index) {
	// Hosts are killed between runs, so the provider's keys live outside them.
	const seen = externalKeyStore(process.ppid, `${index}-${ctx.caseIndex}`);
	return {
		charge: ctx.instrument(
			async (_orderId, key) => {
				const replayed = key !== undefined && seen.has(key);
				if (key !== undefined) seen.add(key);
				return { replayed };
			},
			{
				kind: "payment",
				subject: (orderId) => orderId,
				idempotencyKey: (_orderId, key) => key,
				isDeduplicated: (res) => res.replayed,
			},
		),
		email: ctx.instrument(async () => "sent", { kind: "email", subject: (to) => to }),
	};
}

const build = (index) => () => {
	const c = CASES[index];
	return scenario()
		.name("conformance-checkout-process")
		.runtime(
			workflowsProcessRuntime({ scenarioModule: import.meta.url, exportName: `case${index}` }),
		)
		.effects((ctx) => checkoutEffects(ctx, index))
		.workflow(({ charge, email }) => async (wf) => {
			const receipt = (ephemeral) =>
				wf.step({ name: "receipt", ephemeral, ...fast, run: () => email("a@example.com") });
			if (c.shape.ephemeralReceiptFirst) await receipt(true);
			await wf.step({
				name: "charge",
				...fast,
				...c.shape.charge,
				run: () => charge("o-1", c.shape.key ? `${wf.workflowId}:charge` : undefined),
			});
			if (!c.shape.ephemeralReceiptFirst) await receipt(false);
		})
		.budget({ graceMs: CONFORMANCE_GRACE_MS })
		.case(c.name, c.faults)
		.build();
};

export const case0 = build(0);
export const case1 = build(1);
export const case2 = build(2);
export const case3 = build(3);
export const case4 = build(4);
export const case5 = build(5);
