import {
	type EffectContext,
	type InstrumentOptions,
	ReplayGuardError,
	systemSleeper,
} from "@replayguard/core";

/** Fail the first `times` calls before anything is applied. */
export interface FailureScript {
	/** Number of leading calls that fail. */
	times: number;
	/** Error to throw (default: `FakeServiceError` with `status`). */
	error?: () => Error;
	/** Status of the failure (default 503). */
	status?: number;
}

/**
 * A fake service rejected the request (validation error or scripted failure).
 *
 * @example
 * if (error instanceof FakeServiceError && error.status === 503) retry();
 */
export class FakeServiceError extends ReplayGuardError {
	declare readonly code: "RG_FAKE_SERVICE_FAILURE";
	/** HTTP-like status. */
	readonly status: number;

	constructor(status: number, message: string) {
		super("RG_FAKE_SERVICE_FAILURE", message);
		this.status = status;
	}
}

/**
 * Thrown inside a recorded call so the attempt is recorded as failed while the caller still
 * receives `response` (e.g. an HTTP 404) instead of an exception.
 *
 * @example
 * throw new FailedResponse({ status: 404, body: undefined, replayed: false });
 */
export class FailedResponse<R> extends Error {
	/** Response returned to the caller. */
	readonly response: R;

	constructor(response: R) {
		super("service answered with a failure response");
		this.name = "FailedResponse";
		this.response = response;
	}
}

/** How a fake operation is recorded and disturbed. */
export interface RecordableOptions<A extends readonly unknown[], R>
	extends InstrumentOptions<A, R> {
	/** Latency per call, awaited inside the recorded call. */
	latencyMs?: (...args: A) => number;
	/** Scripted leading failures. */
	failures?: FailureScript;
	/** Answer scripted failures with this response instead of throwing. */
	failureResponse?: (status: number) => R;
}

/**
 * Waits `ms` on the context's sleeper (real timers without a context).
 *
 * @example
 * await delay(ctx, 50);
 */
export async function delay(ctx: EffectContext | undefined, ms: number): Promise<void> {
	if (ms > 0) await (ctx?.sleeper ?? systemSleeper).sleep(ms);
}

/**
 * Wraps a fake operation: latency and scripted failures happen inside the recorded call, which
 * goes through `ctx.instrument` when a context is given (plain call otherwise).
 *
 * @example
 * const send = recordable(ctx, doSend, { kind: "email.send", subject: (m) => m.to });
 */
export function recordable<A extends readonly unknown[], R>(
	ctx: EffectContext | undefined,
	fn: (...args: A) => Promise<R>,
	options: RecordableOptions<A, R>,
): (...args: A) => Promise<R> {
	const { latencyMs, failures, failureResponse, ...instrumentOptions } = options;
	let failed = 0;
	const inner = async (...args: A): Promise<R> => {
		await delay(ctx, latencyMs?.(...args) ?? 0);
		if (failures && failed < failures.times) {
			failed++;
			const status = failures.status ?? 503;
			if (failures.error) throw failures.error();
			if (failureResponse) throw new FailedResponse(failureResponse(status));
			throw new FakeServiceError(
				status,
				`${options.kind} failed with status ${status} (scripted failure ${failed} of ${failures.times})`,
			);
		}
		return fn(...args);
	};
	const call = ctx ? ctx.instrument(inner, instrumentOptions) : inner;
	return async (...args: A) => {
		try {
			return await call(...args);
		} catch (error) {
			if (error instanceof FailedResponse) return error.response as R;
			throw error;
		}
	};
}

/**
 * A frozen copy of a list of records for read-only assertions.
 *
 * @example
 * get charges() { return frozenCopy(charges); }
 */
export function frozenCopy<T extends object>(list: readonly T[]): readonly Readonly<T>[] {
	return Object.freeze(list.map((item) => Object.freeze({ ...item })));
}

/**
 * Sequential, zero-padded id (`ch_000001`).
 *
 * @example
 * sequentialId("ch", 1); // "ch_000001"
 */
export function sequentialId(prefix: string, n: number): string {
	return `${prefix}_${String(n).padStart(6, "0")}`;
}
