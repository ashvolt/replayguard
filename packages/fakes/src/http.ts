import { canonicalHash, type EffectContext, systemClock } from "@replayguard/core";
import { IdempotencyStore } from "./idempotency-store.js";
import { FailedResponse, frozenCopy, recordable } from "./recordable.js";

/** A configured route. */
export interface HttpRoute {
	/** HTTP method (case-insensitive). */
	method: string;
	/** Exact path. */
	path: string;
	/** Response status (default 200). Statuses ≥ 400 are recorded as failed. */
	status?: number;
	/** Response body, or a function producing it per applied request. */
	body?: unknown;
	/** Response time. */
	latencyMs?: number;
	/** Header carrying an idempotency key (case-insensitive). */
	idempotencyHeader?: string;
}

/** Request options. */
export interface HttpRequestInit {
	/** Request headers. */
	headers?: Record<string, string>;
	/** Request body. */
	body?: unknown;
}

/** A response from the fake. */
export interface HttpResponse {
	/** Status. */
	status: number;
	/** Body. */
	body: unknown;
	/** Whether the response replayed a stored one. */
	replayed: boolean;
}

/** A request seen by the fake. */
export interface HttpRequestRecord {
	/** Upper-cased method. */
	method: string;
	/** Path. */
	path: string;
	/** Headers as sent. */
	headers: Record<string, string>;
	/** Body as sent. */
	body: unknown;
	/** Response status. */
	status: number;
	/** Whether the response was a replay. */
	replayed: boolean;
	/** Response time (injected clock). */
	at: number;
}

/** Fake HTTP API. */
export interface FakeHttp {
	/** Sends a request; kind `http:<METHOD> <path>`. */
	request(method: string, path: string, init?: HttpRequestInit): Promise<HttpResponse>;
	/** Requests seen (read-only copy). */
	readonly requests: readonly Readonly<HttpRequestRecord>[];
}

type Call = (init: HttpRequestInit) => Promise<HttpResponse>;

function header(headers: Record<string, string> | undefined, name: string): string | undefined {
	const wanted = name.toLowerCase();
	return Object.entries(headers ?? {}).find(([k]) => k.toLowerCase() === wanted)?.[1];
}

/**
 * Creates a fake HTTP API from route definitions; unknown routes answer 404.
 *
 * @example
 * const http = createFakeHttp(ctx, {
 *   routes: [{ method: "POST", path: "/orders", status: 201, idempotencyHeader: "Idempotency-Key" }],
 * });
 */
export function createFakeHttp(
	ctx?: EffectContext,
	options: { routes: HttpRoute[] } = { routes: [] },
): FakeHttp {
	const requests: HttpRequestRecord[] = [];
	const clock = ctx?.clock ?? systemClock;
	const calls = new Map<string, Call>();

	const callFor = (method: string, path: string): Call => {
		const id = `${method} ${path}`;
		const cached = calls.get(id);
		if (cached) return cached;
		const route = options.routes.find((r) => r.method.toUpperCase() === method && r.path === path);
		const store = new IdempotencyStore<{ status: number; body: unknown }>();
		const respond = async (init: HttpRequestInit): Promise<HttpResponse> => {
			const key = route?.idempotencyHeader
				? header(init.headers, route.idempotencyHeader)
				: undefined;
			const produce = async () =>
				route
					? {
							status: route.status ?? 200,
							body: typeof route.body === "function" ? (route.body as () => unknown)() : route.body,
						}
					: { status: 404, body: { error: `no route for ${id}` } };
			const { result, replayed } =
				key === undefined
					? { result: await produce(), replayed: false }
					: await store.run(key, canonicalHash(init.body ?? null), produce);
			const response = { ...result, replayed };
			requests.push({
				method,
				path,
				headers: { ...init.headers },
				body: init.body,
				status: response.status,
				replayed,
				at: clock.now(),
			});
			if (response.status >= 400) throw new FailedResponse(response);
			return response;
		};
		const call = recordable(ctx, respond, {
			kind: `http:${id}`,
			subject: (init) => canonicalHash(init.body ?? null),
			idempotencyKey: (init) =>
				route?.idempotencyHeader ? header(init.headers, route.idempotencyHeader) : undefined,
			isDeduplicated: (res) => res.replayed,
			latencyMs: () => route?.latencyMs ?? 0,
		});
		calls.set(id, call);
		return call;
	};

	return {
		request: (method, path, init = {}) => callFor(method.toUpperCase(), path)(init),
		get requests() {
			return frozenCopy(requests);
		},
	};
}
