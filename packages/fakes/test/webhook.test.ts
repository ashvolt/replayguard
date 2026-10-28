import { describe, expect, it } from "vitest";
import { createFakeWebhookReceiver } from "../src/webhook.js";
import { statuses, testContext } from "./support/context.js";

const event = { id: "evt_1", type: "order.paid", payload: { orderId: "o-1" } };

describe("createFakeWebhookReceiver (US4)", () => {
	it("processes an event once and acknowledges duplicates as deduplicated (AS1)", async () => {
		const { ctx, ledger } = testContext();
		const receiver = createFakeWebhookReceiver(ctx);
		expect(await receiver.deliver(event)).toEqual({ status: 200, deduplicated: false });
		expect(await receiver.deliver(event)).toEqual({ status: 200, deduplicated: true });
		expect(receiver.processed).toEqual([event]);
		expect(receiver.deliveries).toEqual([
			{ eventId: "evt_1", status: 200, deduplicated: false, at: 1_000 },
			{ eventId: "evt_1", status: 200, deduplicated: true, at: 1_000 },
		]);
		expect(ledger.attempts()).toMatchObject([
			{ kind: "webhook.deliver", subject: "evt_1", status: "applied" },
			{ kind: "webhook.deliver", subject: "evt_1", status: "deduplicated" },
		]);
	});

	it("processes duplicates when dedup is off", async () => {
		const receiver = createFakeWebhookReceiver(undefined, { dedup: false });
		await receiver.deliver(event);
		await receiver.deliver(event);
		expect(receiver.processed).toHaveLength(2);
	});

	it("fails the first N deliveries with status 500, then succeeds (AS2)", async () => {
		const { ctx, ledger, sleeper } = testContext();
		const receiver = createFakeWebhookReceiver(ctx, { failFirst: 2, latencyMs: 5 });
		const results = [];
		for (let i = 0; i < 3; i++) {
			const pending = receiver.deliver(event);
			await sleeper.advance(5);
			results.push(await pending);
		}
		expect(results).toEqual([
			{ status: 500, deduplicated: false },
			{ status: 500, deduplicated: false },
			{ status: 200, deduplicated: false },
		]);
		expect(statuses(ledger)).toEqual(["failed", "failed", "applied"]);
		expect(receiver.processed).toHaveLength(1);
		expect(receiver.deliveries.map((d) => d.status)).toEqual([500, 500, 200]);
		expect(Object.isFrozen(receiver.deliveries)).toBe(true);
	});
});
