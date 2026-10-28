import { describe, expect, it } from "vitest";
import { IdempotencyConflictError, IdempotencyInFlightError } from "../src/idempotency-store.js";
import { createFakePayment } from "../src/payment.js";
import { FakeServiceError } from "../src/recordable.js";
import { statuses, testContext } from "./support/context.js";

describe("createFakePayment (US1)", () => {
	it("charges with sequential ids, default currency and the clock time", async () => {
		const { ctx, ledger } = testContext();
		const payment = createFakePayment(ctx);
		const a = await payment.charge({ orderId: "o-1", amount: 500 });
		const b = await payment.charge({ orderId: "o-2", amount: 700, currency: "eur" });
		expect(a).toEqual({
			charge: {
				id: "ch_000001",
				orderId: "o-1",
				amount: 500,
				currency: "usd",
				createdAt: 1_000,
				refunded: false,
			},
			replayed: false,
		});
		expect(b.charge).toMatchObject({ id: "ch_000002", currency: "eur" });
		expect(ledger.attempts()).toMatchObject([
			{ kind: "payment.charge", subject: "o-1", status: "applied" },
			{ kind: "payment.charge", subject: "o-2", status: "applied" },
		]);
	});

	it("replays the original charge for a reused idempotency key (AS1)", async () => {
		const { ctx, ledger } = testContext();
		const payment = createFakePayment(ctx);
		const req = { orderId: "o-1", amount: 500, idempotencyKey: "k-1" };
		const first = await payment.charge(req);
		const second = await payment.charge(req);
		expect(second).toEqual({ charge: first.charge, replayed: true });
		expect(payment.charges).toHaveLength(1);
		expect(payment.charges[0]).toMatchObject({ idempotencyKey: "k-1" });
		expect(statuses(ledger)).toEqual(["applied", "deduplicated"]);
		expect(ledger.attempts()[1]).toMatchObject({ idempotencyKey: "k-1" });
	});

	it("charges twice when idempotency is disabled (AS2)", async () => {
		const payment = createFakePayment(undefined, { idempotency: false });
		const req = { orderId: "o-1", amount: 500, idempotencyKey: "k-1" };
		await payment.charge(req);
		const second = await payment.charge(req);
		expect(second.replayed).toBe(false);
		expect(payment.charges.map((c) => c.id)).toEqual(["ch_000001", "ch_000002"]);
	});

	it("charges every call without a key", async () => {
		const payment = createFakePayment();
		await payment.charge({ orderId: "o-1", amount: 500 });
		await payment.charge({ orderId: "o-1", amount: 500 });
		expect(payment.charges).toHaveLength(2);
	});

	it("rejects a key reused with a different amount (AS3)", async () => {
		const { ctx, ledger } = testContext();
		const payment = createFakePayment(ctx);
		await payment.charge({ orderId: "o-1", amount: 500, idempotencyKey: "k" });
		await expect(
			payment.charge({ orderId: "o-1", amount: 600, idempotencyKey: "k" }),
		).rejects.toThrow(IdempotencyConflictError);
		expect(payment.charges).toHaveLength(1);
		expect(statuses(ledger)).toEqual(["applied", "failed"]);
	});

	it("resolves after the configured latency on the injected clock (AS4)", async () => {
		const { ctx, sleeper } = testContext();
		const payment = createFakePayment(ctx, { latencyMs: 200 });
		const pending = payment.charge({ orderId: "o-1", amount: 1 });
		await new Promise((r) => setTimeout(r, 0));
		expect(payment.charges).toHaveLength(0);
		await sleeper.advance(200);
		expect((await pending).charge.createdAt).toBe(1_200);
	});

	it("rejects concurrent same-key charges by default and waits when configured", async () => {
		const { ctx, sleeper } = testContext();
		const conflict = createFakePayment(ctx, { latencyMs: 10 });
		const req = { orderId: "o-1", amount: 1, idempotencyKey: "k" };
		const first = conflict.charge(req);
		await new Promise((r) => setTimeout(r, 0));
		const second = conflict.charge(req).catch((e: unknown) => e);
		await sleeper.advance(10);
		await first;
		expect(await second).toBeInstanceOf(IdempotencyInFlightError);

		const waiting = createFakePayment(ctx, { latencyMs: 10, inFlight: "wait" });
		const w1 = waiting.charge(req);
		await new Promise((r) => setTimeout(r, 0));
		const w2 = waiting.charge(req);
		await sleeper.advance(10);
		expect((await w2).replayed).toBe(true);
		expect((await w1).replayed).toBe(false);
		expect(waiting.charges).toHaveLength(1);
	});

	it("validates amount and currency inside the recorded call", async () => {
		const { ctx, ledger } = testContext();
		const payment = createFakePayment(ctx);
		for (const amount of [0, -1, 1.5, Number.NaN]) {
			await expect(payment.charge({ orderId: "o", amount })).rejects.toMatchObject({
				status: 400,
				message: `amount must be an integer > 0, got ${amount}`,
			});
		}
		await expect(payment.charge({ orderId: "o", amount: 1, currency: "dollars" })).rejects.toThrow(
			'currency must be a 3-letter ISO 4217 code, got "dollars"',
		);
		await expect(payment.charge({ orderId: "o", amount: 1 })).resolves.toBeDefined();
		expect(statuses(ledger)).toEqual(["failed", "failed", "failed", "failed", "failed", "applied"]);
		await expect(payment.charge({ orderId: "o", amount: 0 })).rejects.toBeInstanceOf(
			FakeServiceError,
		);
	});

	it("scripts failures before applying", async () => {
		const payment = createFakePayment(undefined, { failures: { times: 1 } });
		await expect(payment.charge({ orderId: "o", amount: 1 })).rejects.toMatchObject({
			status: 503,
		});
		await payment.charge({ orderId: "o", amount: 1 });
		expect(payment.charges.map((c) => c.id)).toEqual(["ch_000001"]);
	});

	it("uses a custom subject", async () => {
		const { ctx, ledger } = testContext();
		const payment = createFakePayment(ctx, { subject: (r) => `${r.orderId}:${r.amount}` });
		await payment.charge({ orderId: "o", amount: 5 });
		expect(ledger.attempts()[0]?.subject).toBe("o:5");
	});

	it("refunds a charge once", async () => {
		const { ctx, ledger } = testContext();
		const payment = createFakePayment(ctx);
		const { charge } = await payment.charge({ orderId: "o", amount: 5 });
		expect(await payment.refund(charge.id)).toEqual({ refunded: true });
		expect(await payment.refund(charge.id)).toEqual({ refunded: false });
		expect(await payment.refund("ch_999999")).toEqual({ refunded: false });
		expect(payment.charges[0]?.refunded).toBe(true);
		expect(ledger.attempts().slice(1)).toMatchObject([
			{ kind: "payment.refund", subject: charge.id, status: "applied" },
			{ kind: "payment.refund", subject: charge.id, status: "applied" },
			{ kind: "payment.refund", subject: "ch_999999", status: "applied" },
		]);
	});

	it("exposes read-only state", async () => {
		const payment = createFakePayment();
		await payment.charge({ orderId: "o", amount: 5 });
		const charges = payment.charges;
		expect(Object.isFrozen(charges)).toBe(true);
		expect(Object.isFrozen(charges[0])).toBe(true);
		expect(() => (charges as unknown as unknown[]).push({})).toThrow(TypeError);
		await payment.charge({ orderId: "o", amount: 5 });
		expect(charges).toHaveLength(1);
	});
});
