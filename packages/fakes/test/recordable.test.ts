import { describe, expect, it } from "vitest";
import { FailedResponse, FakeServiceError, recordable } from "../src/recordable.js";
import { statuses, testContext } from "./support/context.js";

describe("recordable (T004)", () => {
	it("records calls through ctx.instrument with kind and subject", async () => {
		const { ctx, ledger } = testContext();
		const op = recordable(ctx, async (x: string) => x.toUpperCase(), {
			kind: "demo.op",
			subject: (x) => x,
		});
		expect(await op("a")).toBe("A");
		expect(ledger.attempts()).toMatchObject([{ kind: "demo.op", subject: "a", status: "applied" }]);
	});

	it("works without a context and records nothing", async () => {
		const op = recordable(undefined, async (x: number) => x + 1, { kind: "demo.op" });
		expect(await op(1)).toBe(2);
	});

	it("waits for latency through the context sleeper inside the recorded call", async () => {
		const { ctx, ledger, sleeper } = testContext();
		const op = recordable(ctx, async () => "done", { kind: "demo.op", latencyMs: () => 50 });
		const pending = op();
		await new Promise((r) => setTimeout(r, 0));
		expect(statuses(ledger)).toEqual(["started"]);
		expect(sleeper.pending).toBe(1);
		await sleeper.advance(50);
		expect(await pending).toBe("done");
		expect(ledger.attempts()[0]).toMatchObject({
			status: "applied",
			startedAt: 1_000,
			settledAt: 1_050,
		});
	});

	it("skips the sleeper when latency is zero", async () => {
		const { ctx, sleeper } = testContext();
		const op = recordable(ctx, async () => "done", { kind: "demo.op", latencyMs: () => 0 });
		expect(await op()).toBe("done");
		expect(sleeper.pending).toBe(0);
	});

	it("uses real timers for latency without a context", async () => {
		const op = recordable(undefined, async () => "done", { kind: "demo.op", latencyMs: () => 1 });
		expect(await op()).toBe("done");
	});

	it("fails the first N calls before applying, then succeeds", async () => {
		const { ctx, ledger } = testContext();
		let applied = 0;
		const op = recordable(ctx, async () => ++applied, {
			kind: "demo.op",
			failures: { times: 2 },
		});
		const first = await op().catch((e: unknown) => e);
		expect(first).toBeInstanceOf(FakeServiceError);
		expect(first).toMatchObject({
			name: "FakeServiceError",
			code: "RG_FAKE_SERVICE_FAILURE",
			status: 503,
			message: "demo.op failed with status 503 (scripted failure 1 of 2)",
		});
		await expect(op()).rejects.toMatchObject({
			message: "demo.op failed with status 503 (scripted failure 2 of 2)",
		});
		expect(await op()).toBe(1);
		expect(applied).toBe(1);
		expect(statuses(ledger)).toEqual(["failed", "failed", "applied"]);
	});

	it("uses the scripted error or status", async () => {
		const custom = recordable(undefined, async () => 1, {
			kind: "demo.op",
			failures: { times: 1, error: () => new TypeError("custom") },
		});
		await expect(custom()).rejects.toThrow(TypeError);
		const status = recordable(undefined, async () => 1, {
			kind: "demo.op",
			failures: { times: 1, status: 429 },
		});
		await expect(status()).rejects.toMatchObject({ status: 429 });
	});

	it("turns scripted failures into failed responses when the fake answers with a status", async () => {
		const { ctx, ledger } = testContext();
		const op = recordable(ctx, async () => ({ status: 200 }), {
			kind: "demo.op",
			failures: { times: 1, status: 500 },
			failureResponse: (status) => ({ status }),
		});
		expect(await op()).toEqual({ status: 500 });
		expect(await op()).toEqual({ status: 200 });
		expect(statuses(ledger)).toEqual(["failed", "applied"]);
	});

	it("records a FailedResponse thrown by the operation as failed and returns its response", async () => {
		const { ctx, ledger } = testContext();
		const op = recordable(
			ctx,
			async (): Promise<{ status: number }> => {
				throw new FailedResponse({ status: 404 });
			},
			{ kind: "demo.op" },
		);
		expect(await op()).toEqual({ status: 404 });
		expect(ledger.attempts()[0]).toMatchObject({
			status: "failed",
			error: { name: "FailedResponse", message: "service answered with a failure response" },
		});
	});

	it("marks deduplicated results", async () => {
		const { ctx, ledger } = testContext();
		const op = recordable(ctx, async () => ({ replayed: true }), {
			kind: "demo.op",
			idempotencyKey: () => "k",
			isDeduplicated: (r) => r.replayed,
		});
		await op();
		expect(ledger.attempts()[0]).toMatchObject({ status: "deduplicated", idempotencyKey: "k" });
	});
});
