import { fault, instrument, overlapping } from "@replayguard/core";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { host } from "./support/host.js";

const applied = (r: Awaited<ReturnType<typeof host>>, kind: string) =>
	r.ledger.attempts.filter((a) => a.kind === kind && a.status === "applied").length;

/** Spike F0 hypotheses reproduced through ReplayGuard's public fault API (SC-001). */
describe("spike parity (H0–H4)", () => {
	it("H0: lost response → the step retries and the effect is applied twice", async () => {
		const r = await host(
			(ledger) => {
				const charge = instrument(ledger, async () => "ok", { kind: "payment" });
				return async (ctx: WorkflowContextInterface) =>
					ctx.step({
						name: "charge",
						retryBackoffBase: 1,
						retryBackoffMax: 1,
						run: () => charge(),
					});
			},
			[fault.loseResponse("payment")],
		);
		expect(r.result?.state).toBe("completed");
		expect(applied(r, "payment")).toBe(2);
		expect(r.restarts).toBe(0);
	});

	it("H1: crash after the provider applied → restart re-executes the step", async () => {
		const r = await host(
			(ledger) => {
				const charge = instrument(ledger, async () => "ok", { kind: "payment" });
				return async (ctx: WorkflowContextInterface) => ctx.step("charge", () => charge());
			},
			[fault.crashAfter("payment")],
		);
		expect(r.result?.state).toBe("completed");
		expect(r.restarts).toBe(1);
		expect(applied(r, "payment")).toBe(2);
		expect(r.ledger.faults).toHaveLength(1);
	});

	it("H1b: a stable idempotency key turns the duplicate into a provider dedup", async () => {
		const r = await host(
			(ledger) => {
				const seen = new Set<string>();
				const charge = instrument(
					ledger,
					async (key: string) => {
						const replayed = seen.has(key);
						seen.add(key);
						return { replayed };
					},
					{ kind: "payment", idempotencyKey: (key) => key, isDeduplicated: (res) => res.replayed },
				);
				return async (ctx: WorkflowContextInterface) =>
					ctx.step("charge", () => charge(`${ctx.workflowId}:charge`));
			},
			[fault.crashAfter("payment")],
		);
		expect(r.ledger.attempts.map((a) => a.status)).toEqual(["applied", "deduplicated"]);
	});

	it("H2: crash loops bypass maxRetries (6 charges with maxRetries 2)", async () => {
		const r = await host(
			(ledger) => {
				const charge = instrument(ledger, async () => "ok", { kind: "payment" });
				return async (ctx: WorkflowContextInterface) =>
					ctx.step({ name: "charge", maxRetries: 2, run: () => charge() });
			},
			[1, 2, 3, 4, 5].map((n) => fault.crashAfter("payment", n)),
		);
		expect(r.result?.state).toBe("completed");
		expect(r.restarts).toBe(5);
		expect(applied(r, "payment")).toBe(6);
	});

	it("H3a: retryOnTimeout + provider hang → two charges with overlapping calls", async () => {
		const r = await host(
			(ledger) => {
				const charge = instrument(ledger, async () => "ok", { kind: "payment" });
				return async (ctx: WorkflowContextInterface) =>
					ctx.step({
						name: "charge",
						timeout: 20,
						retryOnTimeout: true,
						maxRetries: 1,
						retryBackoffBase: 1,
						retryBackoffMax: 1,
						run: () => charge(),
					});
			},
			[fault.delay("payment", 80)],
			{ graceMs: 120 },
		);
		expect(r.result?.state).toBe("completed");
		expect(applied(r, "payment")).toBe(2);
		const identity = r.ledger.attempts[0]?.identity as string;
		expect(overlapping(r.ledger.attempts, identity)).toHaveLength(1);
	});

	it("H3b: critical timeout → workflow fails but the charge still lands (orphan)", async () => {
		const r = await host(
			(ledger) => {
				const charge = instrument(ledger, async () => "ok", { kind: "payment" });
				return async (ctx: WorkflowContextInterface) =>
					ctx.step({ name: "charge", timeout: 20, run: () => charge() });
			},
			[fault.delay("payment", 60)],
			{ graceMs: 100 },
		);
		expect(r.result).toBeUndefined();
		expect(r.error).toBeDefined();
		expect(applied(r, "payment")).toBe(1);
	});

	it("H4: ephemeral step results are lost when a later step crashes", async () => {
		const run = (ephemeral: boolean) =>
			host(
				(ledger) => {
					const email = instrument(ledger, async () => "sent", { kind: "email" });
					const charge = instrument(ledger, async () => "ok", { kind: "payment" });
					return async (ctx: WorkflowContextInterface) => {
						await ctx.step({ name: "email", ephemeral, run: () => email() });
						await ctx.step("charge", () => charge());
					};
				},
				[fault.crashAfter("payment")],
			);
		expect(applied(await run(true), "email")).toBe(2);
		expect(applied(await run(false), "email")).toBe(1);
	});
});
