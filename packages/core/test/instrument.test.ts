import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/errors.js";
import { instrument } from "../src/instrument/instrument.js";
import { canonicalHash } from "../src/ledger/canonical.js";
import { EffectLedger } from "../src/ledger/ledger.js";
import { manualClock } from "../src/ports/clock.js";

describe("instrument (US1)", () => {
	it("records an applied attempt and returns the original value", async () => {
		const ledger = new EffectLedger({ clock: manualClock(7) });
		const charge = instrument(
			ledger,
			async (orderId: string, amount: number) => ({ orderId, amount }),
			{
				kind: "payment",
			},
		);
		await expect(charge("o-1", 5)).resolves.toEqual({ orderId: "o-1", amount: 5 });
		const [attempt] = ledger.attempts();
		expect(attempt).toMatchObject({
			kind: "payment",
			subject: canonicalHash(["o-1", 5]),
			identity: `payment::${canonicalHash(["o-1", 5])}`,
			status: "applied",
			startedAt: 7,
			settledAt: 7,
			runIndex: 0,
		});
	});

	it("records failures and rethrows the original error unchanged", async () => {
		const ledger = new EffectLedger();
		const boom = new TypeError("provider down");
		const send = instrument(
			ledger,
			async () => {
				throw boom;
			},
			{ kind: "email" },
		);
		await expect(send()).rejects.toBe(boom);
		expect(ledger.attempts()[0]).toMatchObject({
			status: "failed",
			error: { name: "TypeError", message: "provider down" },
		});
	});

	it("groups identical arguments into one identity and supports a custom subject", async () => {
		const ledger = new EffectLedger();
		const charge = instrument(ledger, async (_orderId: string, _amount: number) => "ok", {
			kind: "payment",
			subject: (orderId) => orderId,
		});
		await charge("o-1", 5);
		await charge("o-1", 9);
		await charge("o-2", 5);
		expect(ledger.byIdentity("payment::o-1")).toHaveLength(2);
		expect(ledger.byIdentity("payment::o-2")).toHaveLength(1);
		const plain = instrument(ledger, async (x: number) => x, { kind: "plain" });
		await plain(1);
		await plain(1);
		expect(
			new Set(
				ledger
					.attempts()
					.filter((a) => a.kind === "plain")
					.map((a) => a.identity),
			).size,
		).toBe(1);
	});

	it("supports functions returning plain values", async () => {
		const ledger = new EffectLedger();
		const sync = instrument(ledger, (x: number) => x * 2, { kind: "sync" });
		await expect(sync(21)).resolves.toBe(42);
		expect(ledger.attempts()[0]?.status).toBe("applied");
	});

	it("validates kind, subject and key lengths", async () => {
		const ledger = new EffectLedger();
		expect(() => instrument(ledger, async () => 1, { kind: "" })).toThrow(ConfigError);
		expect(() => instrument(ledger, async () => 1, { kind: "a".repeat(65) })).toThrow(/1–64/);
		expect(() => instrument(ledger, async () => 1, { kind: "bad\nkind" })).toThrow(ConfigError);
		expect(() => instrument(ledger, async () => 1, { kind: "http:POST /orders" })).not.toThrow();
		const longSubject = instrument(ledger, async () => 1, {
			kind: "k",
			subject: () => "s".repeat(257),
		});
		await expect(longSubject()).rejects.toThrow(/subject must be at most 256/);
		const longKey = instrument(ledger, async () => 1, {
			kind: "k",
			idempotencyKey: () => "k".repeat(256),
		});
		await expect(longKey()).rejects.toThrow(/idempotency key must be at most 255/);
		const fnArg = instrument(ledger, async (_f: () => void) => 1, { kind: "k" });
		await expect(fnArg(() => undefined)).rejects.toMatchObject({ code: "RG_CONFIG_UNHASHABLE" });
		expect(ledger.attempts()).toHaveLength(0);
	});
});
