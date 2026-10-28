import { describe, expect, it } from "vitest";
import { CrashSignal } from "../src/errors.js";
import { instrument } from "../src/instrument/instrument.js";
import { EffectLedger } from "../src/ledger/ledger.js";
import type { PendingCall } from "../src/ledger/types.js";

describe("control-flow hooks (US4)", () => {
	it("beforeStart can prevent the call from starting", async () => {
		const ledger = new EffectLedger();
		let invoked = false;
		const seen: PendingCall[] = [];
		ledger.addHooks({
			beforeStart(call) {
				seen.push(call);
				throw new CrashSignal("crash before");
			},
		});
		const fn = instrument(
			ledger,
			async () => {
				invoked = true;
			},
			{ kind: "payment", subject: () => "o-1", idempotencyKey: () => "key" },
		);
		await expect(fn()).rejects.toBeInstanceOf(CrashSignal);
		expect(invoked).toBe(false);
		expect(ledger.attempts()).toHaveLength(0);
		expect(seen[0]).toMatchObject({
			identity: "payment::o-1",
			kindOccurrence: 1,
			idempotencyKey: "key",
		});
	});

	it("inFlight runs after start and before invoke; awaiting delays the provider", async () => {
		const ledger = new EffectLedger();
		const order: string[] = [];
		ledger.addHooks({
			async inFlight(attempt) {
				order.push(`inFlight:${attempt.status}`);
				await Promise.resolve();
				order.push("inFlight:done");
			},
		});
		const fn = instrument(
			ledger,
			async () => {
				order.push("invoke");
			},
			{ kind: "k" },
		);
		await fn();
		expect(order).toEqual(["inFlight:started", "inFlight:done", "invoke"]);
	});

	it("an inFlight failure settles the attempt as failed without invoking", async () => {
		const ledger = new EffectLedger();
		ledger.addHooks({
			inFlight() {
				throw new CrashSignal("killed while hanging");
			},
		});
		let invoked = false;
		const fn = instrument(
			ledger,
			async () => {
				invoked = true;
			},
			{ kind: "k" },
		);
		await expect(fn()).rejects.toBeInstanceOf(CrashSignal);
		expect(invoked).toBe(false);
		expect(ledger.attempts()[0]).toMatchObject({
			status: "failed",
			error: { name: "CrashSignal" },
		});
	});

	it("afterSettle throwing propagates while the attempt stays applied", async () => {
		const ledger = new EffectLedger();
		ledger.addHooks({
			afterSettle(attempt) {
				if (attempt.status === "applied") throw new Error("ECONNRESET");
			},
		});
		const fn = instrument(ledger, async () => "charged", { kind: "payment" });
		await expect(fn()).rejects.toThrow("ECONNRESET");
		expect(ledger.attempts()[0]?.status).toBe("applied");
	});

	it("afterSettle is awaited and also runs for failures (hook error wins)", async () => {
		const ledger = new EffectLedger();
		const statuses: string[] = [];
		ledger.addHooks({
			async afterSettle(attempt) {
				statuses.push(attempt.status);
				await Promise.resolve();
			},
		});
		const ok = instrument(ledger, async () => 1, { kind: "k" });
		const bad = instrument(
			ledger,
			async () => {
				throw new Error("provider");
			},
			{ kind: "k" },
		);
		await ok();
		await expect(bad()).rejects.toThrow("provider");
		expect(statuses).toEqual(["applied", "failed"]);
		const removeCrash = ledger.addHooks({
			afterSettle() {
				throw new CrashSignal("after failure");
			},
		});
		await expect(bad()).rejects.toBeInstanceOf(CrashSignal);
		removeCrash();
		await expect(bad()).rejects.toThrow("provider");
	});

	it("runs hooks in registration order and removes them", async () => {
		const ledger = new EffectLedger();
		const order: number[] = [];
		const off1 = ledger.addHooks({ beforeStart: () => void order.push(1) });
		ledger.addHooks({ beforeStart: () => void order.push(2) });
		const fn = instrument(ledger, async () => 1, { kind: "k" });
		await fn();
		off1();
		await fn();
		expect(order).toEqual([1, 2, 2]);
	});
});
