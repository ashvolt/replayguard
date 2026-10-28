import { describe, expect, it } from "vitest";
import { ConfigError } from "../../src/errors.js";
import { idempotencyKey } from "../../src/idempotency/key.js";
import { fnv1a64 } from "../../src/ledger/canonical.js";

const ctx = { workflowId: "order-42" };

describe("idempotencyKey (US1)", () => {
	it("joins workflow id and step", () => {
		expect(idempotencyKey(ctx, "charge")).toBe("order-42:charge");
	});

	it("adds iteration, namespace and extra parts", () => {
		expect(idempotencyKey(ctx, "send", { iteration: 3 })).toBe("order-42:send#3");
		expect(idempotencyKey(ctx, "send", { iteration: 0 })).toBe("order-42:send#0");
		expect(idempotencyKey(ctx, "charge", { namespace: "stripe" })).toBe("stripe/order-42:charge");
		expect(idempotencyKey(ctx, "charge", { parts: ["eur", 500] })).toBe("order-42:charge:eur:500");
		expect(idempotencyKey(ctx, "send", { namespace: "mail", iteration: 1, parts: ["a@b.c"] })).toBe(
			"mail/order-42:send#1:a@b.c",
		);
	});

	it("escapes separators so keys stay unambiguous", () => {
		expect(idempotencyKey({ workflowId: "a:b" }, "c")).toBe("a%3Ab:c");
		expect(idempotencyKey({ workflowId: "a" }, "b:c")).toBe("a:b%3Ac");
		expect(idempotencyKey({ workflowId: "100%" }, "s#1/x")).toBe("100%25:s%231%2Fx");
		expect(idempotencyKey(ctx, "s", { parts: [""] })).toBe("order-42:s:");
	});

	it("accepts any object with a workflow id", () => {
		const loopCtx = { workflowId: "wf", other: 1 };
		expect(idempotencyKey(loopCtx, "s")).toBe("wf:s");
	});

	it("rejects empty workflow ids and steps", () => {
		expect(() => idempotencyKey({ workflowId: "" }, "s")).toThrow(ConfigError);
		expect(() => idempotencyKey({ workflowId: "" }, "s")).toThrow(
			"idempotencyKey needs a workflow context with a non-empty workflowId",
		);
		expect(() => idempotencyKey({} as { workflowId: string }, "s")).toThrow(ConfigError);
		expect(() => idempotencyKey(ctx, "")).toThrow("step must be a non-empty string");
	});

	it("validates iteration and namespace", () => {
		for (const iteration of [-1, 1.5, Number.NaN]) {
			expect(() => idempotencyKey(ctx, "s", { iteration })).toThrow(
				`iteration must be an integer ≥ 0, got ${iteration}`,
			);
		}
		expect(() => idempotencyKey(ctx, "s", { namespace: "" })).toThrow(
			"namespace must be 1–64 characters",
		);
		expect(() => idempotencyKey(ctx, "s", { namespace: "n".repeat(65) })).toThrow(ConfigError);
		expect(idempotencyKey(ctx, "s", { namespace: "n".repeat(64) })).toMatch(/^n{64}\//);
		try {
			idempotencyKey(ctx, "");
		} catch (error) {
			expect((error as ConfigError).code).toBe("RG_CONFIG_IDEMPOTENCY_KEY");
		}
	});

	it("hashes keys longer than 255 characters behind a readable prefix", () => {
		const exact = idempotencyKey({ workflowId: "w".repeat(253) }, "s");
		expect(exact).toHaveLength(255);
		const long = idempotencyKey({ workflowId: "w".repeat(254) }, "s");
		const full = `${"w".repeat(254)}:s`;
		expect(long).toBe(`${full.slice(0, 200)}:h${fnv1a64(full)}`);
		expect(long.length).toBeLessThanOrEqual(255);
	});
});
