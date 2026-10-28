import { describe, expect, it } from "vitest";
import { CrashSignal } from "../src/errors.js";
import { instrument } from "../src/instrument/instrument.js";
import { EffectLedger } from "../src/ledger/ledger.js";
import { manualClock } from "../src/ports/clock.js";

describe("faults, dead runs and late completions (US3)", () => {
	it("flags attempts in flight when a fault is recorded", async () => {
		const clock = manualClock();
		const ledger = new EffectLedger({ clock });
		ledger.beginRun();
		let release: () => void = () => undefined;
		const slow = instrument(ledger, () => new Promise<string>((r) => (release = () => r("done"))), {
			kind: "payment",
		});
		const done = instrument(ledger, async () => 1, { kind: "email" });
		await done();
		const pending = slow();
		await Promise.resolve();
		clock.advance(3);
		const fault = ledger.recordFault({ strategy: "crash", anchor: "after payment#1" });
		expect(fault).toEqual({
			id: "F1",
			seq: 1,
			runIndex: 0,
			at: 3,
			strategy: "crash",
			anchor: "after payment#1",
			inFlight: [2],
		});
		release();
		await pending;
		const [email, payment] = ledger.attempts();
		expect(email?.inFlightAtFaults).toEqual([]);
		expect(payment?.inFlightAtFaults).toEqual(["F1"]);
		expect(payment?.status).toBe("applied");
		expect(ledger.recordFault({ strategy: "delay", anchor: "x" }).id).toBe("F2");
	});

	it("dead runs refuse new effects before an attempt is recorded", async () => {
		const ledger = new EffectLedger();
		ledger.beginRun();
		const fn = instrument(ledger, async () => 1, { kind: "k" });
		expect(ledger.isRunDead()).toBe(false);
		ledger.markRunDead(0);
		expect(ledger.isRunDead()).toBe(true);
		expect(ledger.isRunDead(0)).toBe(true);
		await expect(fn()).rejects.toBeInstanceOf(CrashSignal);
		expect(ledger.attempts()).toHaveLength(0);
		ledger.endRun("crashed");
		ledger.beginRun();
		expect(ledger.isRunDead()).toBe(false);
		await fn();
		expect(ledger.attempts()).toHaveLength(1);
		expect(ledger.snapshot().runs[0]?.dead).toBe(true);
	});

	it("ignores unknown runs when marking dead or checking", () => {
		const ledger = new EffectLedger();
		expect(ledger.isRunDead(5)).toBe(false);
		expect(() => ledger.markRunDead(5)).toThrow("unknown run 5");
	});

	it("records completions after a run ended until finalize, then freezes", async () => {
		const clock = manualClock();
		const ledger = new EffectLedger({ clock });
		ledger.beginRun();
		let release: () => void = () => undefined;
		const slow = instrument(ledger, () => new Promise<void>((r) => (release = r)), { kind: "k" });
		const late = slow();
		await Promise.resolve();
		ledger.endRun("failed");
		clock.advance(10);
		release();
		await late;
		expect(ledger.attempts()[0]).toMatchObject({ status: "applied", settledAt: 10 });

		let release2: () => void = () => undefined;
		const slow2 = instrument(ledger, () => new Promise<void>((r) => (release2 = r)), {
			kind: "k2",
		});
		const tooLate = slow2();
		await Promise.resolve();
		const final = ledger.finalize();
		expect(final.finalized).toBe(true);
		release2();
		await tooLate;
		expect(ledger.snapshot().attempts[1]?.status).toBe("started");
		expect(ledger.finalize()).toEqual(final);
		expect(() => ledger.beginRun()).toThrow("ledger is finalized");
	});
});
