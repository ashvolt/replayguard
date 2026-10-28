import { canonicalHash, type EffectContext, systemClock } from "@replayguard/core";
import { IdempotencyStore, type InFlightMode } from "./idempotency-store.js";
import {
	delay,
	type FailureScript,
	FakeServiceError,
	frozenCopy,
	recordable,
	sequentialId,
} from "./recordable.js";

/** A charge request. */
export interface ChargeRequest {
	/** Order being paid. */
	orderId: string;
	/** Integer minor units, > 0. */
	amount: number;
	/** ISO 4217 code (default `usd`). */
	currency?: string;
	/** Idempotency key sent to the provider. */
	idempotencyKey?: string;
}

/** A charge held by the fake provider. */
export interface Charge {
	/** Sequential id, `ch_000001`. */
	id: string;
	/** Order paid. */
	orderId: string;
	/** Integer minor units. */
	amount: number;
	/** ISO 4217 code. */
	currency: string;
	/** Key the charge was created with. */
	idempotencyKey?: string;
	/** Creation time (injected clock). */
	createdAt: number;
	/** Whether the charge was refunded. */
	refunded: boolean;
}

/** Result of `charge`. */
export interface ChargeResult {
	/** The charge (the original one on replays). */
	charge: Charge;
	/** Whether the provider replayed a stored result. */
	replayed: boolean;
}

/** Result of `refund`. */
export interface RefundResult {
	/** False when the charge is unknown or already refunded. */
	refunded: boolean;
}

/** Options for the fake payment provider. */
export interface FakePaymentOptions {
	/** Honor idempotency keys (default true). */
	idempotency?: boolean;
	/** Same-key request while the first is in flight (default `conflict`). */
	inFlight?: InFlightMode;
	/** Processing time per charge. */
	latencyMs?: number;
	/** Scripted leading failures. */
	failures?: FailureScript;
	/** Logical subject (default `orderId`). */
	subject?: (req: ChargeRequest) => string;
}

/** Fake payment provider. */
export interface FakePayment {
	/** Charges a card; kind `payment.charge`. */
	charge(req: ChargeRequest): Promise<ChargeResult>;
	/** Refunds a charge once; kind `payment.refund`. */
	refund(chargeId: string): Promise<RefundResult>;
	/** Charges created (read-only copy). */
	readonly charges: readonly Readonly<Charge>[];
}

function validate(req: ChargeRequest, currency: string): void {
	if (!Number.isInteger(req.amount) || req.amount <= 0) {
		throw new FakeServiceError(400, `amount must be an integer > 0, got ${req.amount}`);
	}
	if (!/^[a-z]{3}$/i.test(currency)) {
		throw new FakeServiceError(
			400,
			`currency must be a 3-letter ISO 4217 code, got ${JSON.stringify(currency)}`,
		);
	}
}

/**
 * Creates a fake payment provider that honors idempotency keys like real providers.
 *
 * @example
 * const payment = createFakePayment(ctx);
 * await payment.charge({ orderId: "o-1", amount: 500, idempotencyKey: "o-1" });
 */
export function createFakePayment(
	ctx?: EffectContext,
	options: FakePaymentOptions = {},
): FakePayment {
	const charges: Charge[] = [];
	const store = new IdempotencyStore<Charge>({ inFlight: options.inFlight ?? "conflict" });
	const clock = ctx?.clock ?? systemClock;

	const create = async (req: ChargeRequest, currency: string): Promise<Charge> => {
		await delay(ctx, options.latencyMs ?? 0);
		const charge: Charge = {
			id: sequentialId("ch", charges.length + 1),
			orderId: req.orderId,
			amount: req.amount,
			currency,
			...(req.idempotencyKey === undefined ? {} : { idempotencyKey: req.idempotencyKey }),
			createdAt: clock.now(),
			refunded: false,
		};
		charges.push(charge);
		return charge;
	};

	const charge = recordable(
		ctx,
		async (req: ChargeRequest): Promise<ChargeResult> => {
			const currency = req.currency ?? "usd";
			validate(req, currency);
			if (options.idempotency === false || req.idempotencyKey === undefined) {
				return { charge: { ...(await create(req, currency)) }, replayed: false };
			}
			const fingerprint = canonicalHash([req.orderId, req.amount, currency]);
			const { result, replayed } = await store.run(req.idempotencyKey, fingerprint, () =>
				create(req, currency),
			);
			return { charge: { ...result }, replayed };
		},
		{
			kind: "payment.charge",
			subject: options.subject ?? ((req) => req.orderId),
			idempotencyKey: (req) => req.idempotencyKey,
			isDeduplicated: (res) => res.replayed,
			...(options.failures ? { failures: options.failures } : {}),
		},
	);

	const refund = recordable(
		ctx,
		async (chargeId: string): Promise<RefundResult> => {
			const found = charges.find((c) => c.id === chargeId);
			if (!found || found.refunded) return { refunded: false };
			found.refunded = true;
			return { refunded: true };
		},
		{ kind: "payment.refund", subject: (chargeId) => chargeId },
	);

	return {
		charge,
		refund,
		get charges() {
			return frozenCopy(charges);
		},
	};
}
