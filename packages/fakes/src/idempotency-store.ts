import { ReplayGuardError } from "@replayguard/core";

/**
 * A key was reused with different request parameters (providers answer 409/422).
 *
 * @example
 * if (error instanceof IdempotencyConflictError) console.log(error.code);
 */
export class IdempotencyConflictError extends ReplayGuardError {
	declare readonly code: "RG_FAKE_IDEMPOTENCY_CONFLICT";

	constructor(key: string) {
		super(
			"RG_FAKE_IDEMPOTENCY_CONFLICT",
			`idempotency key ${JSON.stringify(key)} was reused with different parameters`,
		);
	}
}

/**
 * A request with the same key is still being processed.
 *
 * @example
 * if (error instanceof IdempotencyInFlightError) await retryLater();
 */
export class IdempotencyInFlightError extends ReplayGuardError {
	declare readonly code: "RG_FAKE_IDEMPOTENCY_IN_FLIGHT";

	constructor(key: string) {
		super(
			"RG_FAKE_IDEMPOTENCY_IN_FLIGHT",
			`a request with idempotency key ${JSON.stringify(key)} is still in progress`,
		);
	}
}

/** What to do with a same-key request while the first is in flight. */
export type InFlightMode = "conflict" | "wait";

/** Result of an idempotent execution. */
export interface IdempotentResult<R> {
	/** The original result. */
	result: R;
	/** Whether this call replayed a stored result. */
	replayed: boolean;
}

interface Entry<R> {
	fingerprint: string;
	state: "in-flight" | "done";
	promise: Promise<R>;
}

/**
 * Provider-side idempotency index: same key + same fingerprint replays the stored result, a
 * different fingerprint is a conflict, and failed requests are forgotten so they can be retried.
 *
 * @example
 * const store = new IdempotencyStore<Charge>();
 * const { result, replayed } = await store.run(key, canonicalHash(req), () => createCharge(req));
 */
export class IdempotencyStore<R> {
	readonly #entries = new Map<string, Entry<R>>();
	readonly #inFlight: InFlightMode;

	constructor(options: { inFlight?: InFlightMode } = {}) {
		this.#inFlight = options.inFlight ?? "conflict";
	}

	/**
	 * Executes once per key; replays, conflicts or waits for later calls with the same key.
	 *
	 * @example
	 * await store.run("k", fingerprint, () => provider.create(req));
	 */
	async run(
		key: string,
		fingerprint: string,
		execute: () => Promise<R>,
	): Promise<IdempotentResult<R>> {
		const existing = this.#entries.get(key);
		if (existing) {
			if (existing.fingerprint !== fingerprint) throw new IdempotencyConflictError(key);
			if (existing.state === "in-flight" && this.#inFlight === "conflict") {
				throw new IdempotencyInFlightError(key);
			}
			return { result: await existing.promise, replayed: true };
		}
		const entry: Entry<R> = { fingerprint, state: "in-flight", promise: execute() };
		this.#entries.set(key, entry);
		try {
			const result = await entry.promise;
			entry.state = "done";
			return { result, replayed: false };
		} catch (error) {
			this.#entries.delete(key);
			throw error;
		}
	}
}
