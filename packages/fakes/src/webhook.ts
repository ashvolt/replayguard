import { type EffectContext, systemClock } from "@replayguard/core";
import { FailedResponse, frozenCopy, recordable } from "./recordable.js";

/** An event delivered to the receiver. */
export interface WebhookEvent {
	/** Event id (`webhook-id`). */
	id: string;
	/** Event type. */
	type: string;
	/** Event payload. */
	payload: unknown;
}

/** A delivery seen by the receiver. */
export interface WebhookDeliveryRecord {
	/** Event id. */
	eventId: string;
	/** Response status. */
	status: number;
	/** Whether the event had already been processed. */
	deduplicated: boolean;
	/** Response time (injected clock). */
	at: number;
}

/** Response to a delivery. */
export interface WebhookResponse {
	/** Status (500 for scripted failures). */
	status: number;
	/** Whether the event had already been processed. */
	deduplicated: boolean;
}

/** Options for the webhook receiver. */
export interface FakeWebhookReceiverOptions {
	/** Ignore already-processed event ids (default true). */
	dedup?: boolean;
	/** Answer 500 to the first N deliveries (default 0). */
	failFirst?: number;
	/** Response time. */
	latencyMs?: number;
}

/** Fake webhook receiving endpoint. */
export interface FakeWebhookReceiver {
	/** Delivers an event; kind `webhook.deliver`. */
	deliver(event: WebhookEvent): Promise<WebhookResponse>;
	/** Events processed (read-only copy). */
	readonly processed: readonly Readonly<WebhookEvent>[];
	/** Every delivery (read-only copy). */
	readonly deliveries: readonly Readonly<WebhookDeliveryRecord>[];
}

/**
 * Creates a webhook receiver that deduplicates by event id, as receivers are told to.
 *
 * @example
 * const receiver = createFakeWebhookReceiver(ctx, { failFirst: 1 });
 * await receiver.deliver({ id: "evt_1", type: "order.paid", payload: {} });
 */
export function createFakeWebhookReceiver(
	ctx?: EffectContext,
	options: FakeWebhookReceiverOptions = {},
): FakeWebhookReceiver {
	const processed: WebhookEvent[] = [];
	const deliveries: WebhookDeliveryRecord[] = [];
	const clock = ctx?.clock ?? systemClock;
	const latency = options.latencyMs ?? 0;
	const failFirst = options.failFirst ?? 0;

	const deliver = recordable(
		ctx,
		async (event: WebhookEvent): Promise<WebhookResponse> => {
			const failing = deliveries.length < failFirst;
			const deduplicated =
				!failing && options.dedup !== false && processed.some((e) => e.id === event.id);
			const status = failing ? 500 : 200;
			deliveries.push({ eventId: event.id, status, deduplicated, at: clock.now() });
			if (failing) throw new FailedResponse({ status, deduplicated });
			if (!deduplicated) processed.push(event);
			return { status, deduplicated };
		},
		{
			kind: "webhook.deliver",
			subject: (event) => event.id,
			isDeduplicated: (res) => res.deduplicated,
			latencyMs: () => latency,
		},
	);

	return {
		deliver,
		get processed() {
			return frozenCopy(processed);
		},
		get deliveries() {
			return frozenCopy(deliveries);
		},
	};
}
