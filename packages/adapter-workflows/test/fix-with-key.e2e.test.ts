import { fault, idempotencyKey, scenario } from "@replayguard/core";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { workflowsRuntime } from "../src/runtime.js";

/** H1 checkout against a provider that dedups by key, with or without sending one. */
const checkout = (withKey: boolean) =>
	scenario()
		.name(withKey ? "checkout-with-key" : "checkout")
		.runtime(workflowsRuntime())
		.effects((ctx) => {
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
			};
		})
		.workflow(({ charge }) => async (wf: WorkflowContextInterface) => {
			await wf.step("charge", () =>
				charge("o-1", withKey ? idempotencyKey(wf, "charge") : undefined),
			);
		})
		.case("crash after charge", [fault.crashAfter("payment")])
		.build();

describe("fixing a duplicate with idempotencyKey (011 T010)", () => {
	it("fails without a key and suggests add-idempotency-key", async () => {
		const classified = await checkout(false).run({ classify: true });
		const [effect] = classified.cases[1]?.effects ?? [];
		expect(classified.verdict).toBe("fail");
		expect(effect?.outcome).toBe("duplicated");
		expect(effect?.hints.map((h) => h.id)).toEqual(["add-idempotency-key"]);
	});

	it("passes with a stable key from idempotencyKey(ctx, step)", async () => {
		const classified = await checkout(true).run({ classify: true });
		const [effect] = classified.cases[1]?.effects ?? [];
		expect(classified.verdict).toBe("pass");
		expect(effect?.outcome).toBe("deduplicated");
		expect(effect?.evidence.keys).toEqual(["replayguard-wf:charge"]);
		expect(effect?.hints).toEqual([]);
	});
});
