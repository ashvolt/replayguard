import { canonicalHash } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { createFakeHttp } from "../src/http.js";
import { IdempotencyConflictError } from "../src/idempotency-store.js";
import { statuses, testContext } from "./support/context.js";

describe("createFakeHttp (US3)", () => {
	it("returns the configured response and records the route kind (AS1)", async () => {
		const { ctx, ledger } = testContext();
		const http = createFakeHttp(ctx, {
			routes: [{ method: "POST", path: "/orders", status: 201, body: { id: "ord_1" } }],
		});
		const res = await http.request("post", "/orders", { body: { sku: "a" } });
		expect(res).toEqual({ status: 201, body: { id: "ord_1" }, replayed: false });
		expect(ledger.attempts()[0]).toMatchObject({
			kind: "http:POST /orders",
			subject: canonicalHash({ sku: "a" }),
			status: "applied",
		});
		expect(http.requests).toEqual([
			{
				method: "POST",
				path: "/orders",
				headers: {},
				body: { sku: "a" },
				status: 201,
				replayed: false,
				at: 1_000,
			},
		]);
	});

	it("defaults to status 200 and an undefined body", async () => {
		const http = createFakeHttp(undefined, { routes: [{ method: "GET", path: "/ping" }] });
		expect(await http.request("GET", "/ping")).toEqual({
			status: 200,
			body: undefined,
			replayed: false,
		});
	});

	it("deduplicates by the idempotency header, case-insensitively (AS2)", async () => {
		const { ctx, ledger } = testContext();
		let created = 0;
		const http = createFakeHttp(ctx, {
			routes: [
				{
					method: "POST",
					path: "/orders",
					status: 201,
					body: () => ({ id: `ord_${++created}` }),
					idempotencyHeader: "Idempotency-Key",
				},
			],
		});
		const init = { headers: { "idempotency-key": "k-1" }, body: { sku: "a" } };
		const first = await http.request("POST", "/orders", init);
		const second = await http.request("POST", "/orders", init);
		expect(first).toEqual({ status: 201, body: { id: "ord_1" }, replayed: false });
		expect(second).toEqual({ status: 201, body: { id: "ord_1" }, replayed: true });
		expect(statuses(ledger)).toEqual(["applied", "deduplicated"]);
		expect(ledger.attempts()[1]?.idempotencyKey).toBe("k-1");
		expect(http.requests.map((r) => r.replayed)).toEqual([false, true]);
		await expect(http.request("POST", "/orders", { ...init, body: { sku: "b" } })).rejects.toThrow(
			IdempotencyConflictError,
		);
		await http.request("POST", "/orders", { body: { sku: "a" } });
		expect(created).toBe(2);
	});

	it("answers 404 for unknown routes and records a failure (AS3)", async () => {
		const { ctx, ledger } = testContext();
		const http = createFakeHttp(ctx, { routes: [] });
		expect(await http.request("DELETE", "/nope")).toEqual({
			status: 404,
			body: { error: "no route for DELETE /nope" },
			replayed: false,
		});
		expect(ledger.attempts()[0]).toMatchObject({ kind: "http:DELETE /nope", status: "failed" });
		expect(http.requests[0]?.status).toBe(404);
	});

	it("records configured error statuses as failed without throwing", async () => {
		const { ctx, ledger } = testContext();
		const http = createFakeHttp(ctx, {
			routes: [{ method: "GET", path: "/down", status: 503, body: "busy" }],
		});
		expect(await http.request("GET", "/down")).toEqual({
			status: 503,
			body: "busy",
			replayed: false,
		});
		expect(statuses(ledger)).toEqual(["failed"]);
	});

	it("waits for route latency", async () => {
		const { ctx, sleeper } = testContext();
		const http = createFakeHttp(ctx, {
			routes: [{ method: "GET", path: "/slow", latencyMs: 30 }],
		});
		const pending = http.request("GET", "/slow");
		await sleeper.advance(30);
		await pending;
		expect(http.requests[0]?.at).toBe(1_030);
		expect(Object.isFrozen(http.requests)).toBe(true);
	});
});
