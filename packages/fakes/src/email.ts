import { type EffectContext, systemClock } from "@replayguard/core";
import { type FailureScript, frozenCopy, recordable, sequentialId } from "./recordable.js";

/** A message to send. */
export interface EmailInput {
	/** Recipient. */
	to: string;
	/** Template name. */
	template: string;
	/** Template data. */
	data?: unknown;
}

/** A sent message. */
export interface EmailMessage extends EmailInput {
	/** Sequential id, `msg_000001`. */
	id: string;
	/** Send time (injected clock). */
	sentAt: number;
}

/** Result of `send`. */
export interface SendResult {
	/** Message id. */
	id: string;
}

/** Options for the fake email sender. */
export interface FakeEmailOptions {
	/** Delivery time per message. */
	latencyMs?: number;
	/** Scripted leading failures. */
	failures?: FailureScript;
	/** Logical subject (default `to|template`). */
	subject?: (m: EmailInput) => string;
}

/** Fake email sender. */
export interface FakeEmail {
	/** Sends a message; kind `email.send`. Never deduplicates. */
	send(m: EmailInput): Promise<SendResult>;
	/** Messages sent (read-only copy). */
	readonly outbox: readonly Readonly<EmailMessage>[];
}

/**
 * Creates a fake email sender that records every message and never deduplicates.
 *
 * @example
 * const email = createFakeEmail(ctx);
 * await email.send({ to: "a@example.com", template: "receipt" });
 */
export function createFakeEmail(ctx?: EffectContext, options: FakeEmailOptions = {}): FakeEmail {
	const outbox: EmailMessage[] = [];
	const clock = ctx?.clock ?? systemClock;
	const latency = options.latencyMs ?? 0;
	const send = recordable(
		ctx,
		async (m: EmailInput) => {
			const id = sequentialId("msg", outbox.length + 1);
			outbox.push({ id, ...m, sentAt: clock.now() });
			return { id };
		},
		{
			kind: "email.send",
			subject: options.subject ?? ((m) => `${m.to}|${m.template}`),
			latencyMs: () => latency,
			...(options.failures ? { failures: options.failures } : {}),
		},
	);
	return {
		send,
		get outbox() {
			return frozenCopy(outbox);
		},
	};
}
