import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	IdempotencyConflictError,
	IdempotencyInFlightError,
	IdempotencyStore,
} from "../src/idempotency-store.js";

describe("IdempotencyStore (T002)", () => {
	it("executes once and replays the stored result for the same key and fingerprint", async () => {
		const store = new IdempotencyStore<string>();
		let calls = 0;
		const exec = async () => `r${++calls}`;
		expect(await store.run("k", "f", exec)).toEqual({ result: "r1", replayed: false });
		expect(await store.run("k", "f", exec)).toEqual({ result: "r1", replayed: true });
		expect(await store.run("k2", "f", exec)).toEqual({ result: "r2", replayed: false });
		expect(calls).toBe(2);
	});

	it("rejects a reused key with a different fingerprint", async () => {
		const store = new IdempotencyStore<string>();
		await store.run("k", "f1", async () => "a");
		const error = await store.run("k", "f2", async () => "b").catch((e: unknown) => e);
		expect(error).toBeInstanceOf(IdempotencyConflictError);
		expect(error).toMatchObject({
			code: "RG_FAKE_IDEMPOTENCY_CONFLICT",
			message: 'idempotency key "k" was reused with different parameters',
		});
	});

	it("rejects a concurrent request with the same key by default", async () => {
		const store = new IdempotencyStore<string>();
		let release!: (v: string) => void;
		const first = store.run("k", "f", () => new Promise<string>((r) => (release = r)));
		const error = await store.run("k", "f", async () => "b").catch((e: unknown) => e);
		expect(error).toBeInstanceOf(IdempotencyInFlightError);
		expect(error).toMatchObject({
			code: "RG_FAKE_IDEMPOTENCY_IN_FLIGHT",
			message: 'a request with idempotency key "k" is still in progress',
		});
		release("a");
		expect(await first).toEqual({ result: "a", replayed: false });
	});

	it("waits for the in-flight request in wait mode", async () => {
		const store = new IdempotencyStore<string>({ inFlight: "wait" });
		let release!: (v: string) => void;
		const first = store.run("k", "f", () => new Promise<string>((r) => (release = r)));
		const second = store.run("k", "f", async () => "b");
		release("a");
		expect(await first).toEqual({ result: "a", replayed: false });
		expect(await second).toEqual({ result: "a", replayed: true });
	});

	it("checks the fingerprint before waiting", async () => {
		const store = new IdempotencyStore<string>({ inFlight: "wait" });
		void store.run("k", "f", () => new Promise<string>(() => undefined));
		await expect(store.run("k", "other", async () => "b")).rejects.toThrow(
			IdempotencyConflictError,
		);
	});

	it("forgets a key whose request failed so a retry can run", async () => {
		const store = new IdempotencyStore<string>();
		await expect(
			store.run("k", "f", async () => {
				throw new Error("down");
			}),
		).rejects.toThrow("down");
		expect(await store.run("k", "f", async () => "ok")).toEqual({ result: "ok", replayed: false });
	});

	it("N sequential calls with one key execute once (property)", async () => {
		await fc.assert(
			fc.asyncProperty(fc.integer({ min: 1, max: 20 }), async (n) => {
				const store = new IdempotencyStore<number>();
				let calls = 0;
				const results = [];
				for (let i = 0; i < n; i++) results.push(await store.run("k", "f", async () => ++calls));
				expect(calls).toBe(1);
				expect(results.filter((r) => !r.replayed)).toHaveLength(1);
				expect(new Set(results.map((r) => r.result))).toEqual(new Set([1]));
			}),
		);
	});

	it("N concurrent calls in wait mode execute once (property)", async () => {
		await fc.assert(
			fc.asyncProperty(fc.integer({ min: 1, max: 20 }), async (n) => {
				const store = new IdempotencyStore<number>({ inFlight: "wait" });
				let calls = 0;
				const results = await Promise.all(
					Array.from({ length: n }, () => store.run("k", "f", async () => ++calls)),
				);
				expect(calls).toBe(1);
				expect(results.filter((r) => r.replayed)).toHaveLength(n - 1);
			}),
		);
	});
});
