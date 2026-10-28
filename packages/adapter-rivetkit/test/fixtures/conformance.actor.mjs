// Conformance and lifecycle scenarios on real RivetKit actors, loaded by actor host processes.
// Mirrors packages/adapter-workflows/test/conformance.engine.test.ts with the RivetKit step API.
import { actorWorkflow, rivetkitRuntime } from "@replayguard/adapter-rivetkit";
import { fault, scenario } from "@replayguard/core";
import {
	CONFORMANCE_CASES as CASES,
	externalKeyStore,
} from "../../../adapter-workflows/test-support/conformance-cases.mjs";

const fast = { retryBackoffBase: 1, retryBackoffMax: 1 };
const budget = { caseTimeoutMs: 180_000, graceMs: 3_000 };

function checkoutEffects(ctx, scope) {
	// Hosts are killed between runs, so the provider's keys live outside them.
	const seen = externalKeyStore(process.ppid, `actor-${scope}-${ctx.caseIndex}`);
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

const checkout = (exportName, shape) =>
	scenario()
		.name(`actor-${exportName}`)
		.runtime(rivetkitRuntime({ scenarioModule: import.meta.url, exportName }))
		.effects((ctx) => checkoutEffects(ctx, exportName))
		.workflow(({ charge, email }) =>
			actorWorkflow(async (ctx) => {
				const receipt = (ephemeral) =>
					ctx.step({ name: "receipt", ephemeral, ...fast, run: () => email("a@example.com") });
				if (shape.ephemeralReceiptFirst) await receipt(true);
				await ctx.step({
					name: "charge",
					...fast,
					...shape.charge,
					run: () => charge("o-1", shape.key ? `${ctx.workflowId}:charge` : undefined),
				});
				if (!shape.ephemeralReceiptFirst) await receipt(false);
				return "done";
			}),
		)
		.budget(budget);

const conformance = (index) => () =>
	checkout(`case${index}`, CASES[index].shape).case(CASES[index].name, CASES[index].faults).build();

export const case0 = conformance(0);
export const case1 = conformance(1);
export const case2 = conformance(2);
export const case3 = conformance(3);
export const case4 = conformance(4);
export const case5 = conformance(5);

/** Baseline only (lifecycle and leak checks). */
export const baselineOnly = () => checkout("baselineOnly", {}).build();

/** Real OS process kill after the charge applied. */
export const killAfterCharge = () =>
	checkout("killAfterCharge", {})
		.case("kill after charge", [fault.killAfter("payment")])
		.build();

/** A durable sleep: the actor sleeps and the engine wakes it. */
export const sleepThenCharge = () =>
	scenario()
		.name("actor-sleepThenCharge")
		.runtime(rivetkitRuntime({ scenarioModule: import.meta.url, exportName: "sleepThenCharge" }))
		.effects((ctx) => checkoutEffects(ctx, "sleepThenCharge"))
		.workflow(({ charge }) =>
			actorWorkflow(async (ctx) => {
				await ctx.sleep("nap", 500);
				await ctx.step({ name: "charge", ...fast, run: () => charge("o-1", undefined) });
				return "woke";
			}),
		)
		.budget(budget)
		.build();
