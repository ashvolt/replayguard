import { ConfigError, CrashSignal, serializeError } from "../errors.js";
import { canonicalHash } from "../ledger/canonical.js";
import type { EffectLedger } from "../ledger/ledger.js";

/** How an instrumented function is identified and interpreted. */
export interface InstrumentOptions<A extends readonly unknown[], R> {
	/** Effect kind, e.g. `payment` or `http:POST /orders` (1–64 chars). */
	kind: string;
	/** Logical subject; defaults to a canonical hash of the arguments. */
	subject?: (...args: A) => string;
	/** Idempotency key the call sends to the provider, if any (≤ 255 chars). */
	idempotencyKey?: (...args: A) => string | undefined;
	/** Whether the provider reported this call as a replay of an earlier one. */
	isDeduplicated?: (result: R, ...args: A) => boolean;
	/** Opt-in, redacted argument preview stored on the attempt. Never stored otherwise. */
	preview?: (...args: A) => unknown;
}

const KIND = /^[a-z0-9][a-z0-9:._/ -]*$/i;

function checkKind(kind: string): void {
	if (kind.length < 1 || kind.length > 64)
		throw new ConfigError(`kind must be 1–64 chars, got ${kind.length}`);
	if (!KIND.test(kind))
		throw new ConfigError(`kind ${JSON.stringify(kind)} has invalid characters`);
}

/**
 * Wraps a side-effect function so every call is recorded in the ledger without changing its
 * arguments, result or thrown error. Fault hooks registered on the ledger run around the call.
 *
 * @example
 * const charge = instrument(ledger, stripe.charge, {
 *   kind: "payment",
 *   subject: (req) => req.orderId,
 *   idempotencyKey: (req) => req.idempotencyKey,
 *   isDeduplicated: (res) => res.replayed,
 * });
 */
export function instrument<A extends readonly unknown[], R>(
	ledger: EffectLedger,
	fn: (...args: A) => R | Promise<R>,
	options: InstrumentOptions<A, R>,
): (...args: A) => Promise<R> {
	checkKind(options.kind);
	return async (...args: A): Promise<R> => {
		if (ledger.isRunDead())
			throw new CrashSignal(`effect ${options.kind} called after the run crashed`);
		const subject = options.subject ? options.subject(...args) : canonicalHash(args);
		if (subject.length > 256) throw new ConfigError("subject must be at most 256 characters");
		const key = options.idempotencyKey?.(...args);
		if (key !== undefined && key.length > 255)
			throw new ConfigError("idempotency key must be at most 255 characters");
		const call = ledger.pendingCall(options.kind, subject, key);
		for (const hook of ledger.hooks()) await hook.beforeStart?.(call);
		const attempt = ledger.beginAttempt(call, options.preview?.(...args));
		let result: R;
		try {
			for (const hook of ledger.hooks()) await hook.inFlight?.(attempt);
			result = await fn(...args);
		} catch (error) {
			ledger.settleAttempt(attempt.seq, "failed", serializeError(error));
			for (const hook of ledger.hooks()) await hook.afterSettle?.(attempt);
			throw error;
		}
		ledger.settleAttempt(
			attempt.seq,
			options.isDeduplicated?.(result, ...args) ? "deduplicated" : "applied",
			undefined,
		);
		for (const hook of ledger.hooks()) await hook.afterSettle?.(attempt);
		return result;
	};
}
