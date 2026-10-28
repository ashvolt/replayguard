import { describe, expect, it } from "vitest";
import { CrashSignal } from "../../src/errors.js";
import { FaultController } from "../../src/faults/controller.js";
import { fault } from "../../src/faults/types.js";
import { instrument } from "../../src/instrument/instrument.js";
import { EffectLedger } from "../../src/ledger/ledger.js";
import { manualSleeper } from "../../src/ports/sleeper.js";
import { FakePersistence } from "../support/fake-persistence.js";

function setup() {
	const ledger = new EffectLedger();
	const persistence = new FakePersistence();
	ledger.beginRun();
	const env = { ledger, persistence, sleeper: manualSleeper(), processIsolated: false };
	const providerCalls: string[] = [];
	const charge = instrument(
		ledger,
		async (id: string) => {
			providerCalls.push(id);
			return id;
		},
		{ kind: "payment", subject: (id) => id },
	);
	return { ledger, persistence, env, charge, providerCalls };
}

describe("crash strategy", () => {
	it("after: lets the provider apply, then kills persistence and the run", async () => {
		const { ledger, persistence, env, charge, providerCalls } = setup();
		const armed = new FaultController().arm([fault.crashAfter("payment")], env);
		await expect(charge("o-1")).rejects.toBeInstanceOf(CrashSignal);
		expect(providerCalls).toEqual(["o-1"]);
		expect(ledger.attempts()[0]?.status).toBe("applied");
		expect(persistence.crashed).toBe(true);
		expect(ledger.isRunDead()).toBe(true);
		expect(() => persistence.write()).toThrow(CrashSignal);
		expect(ledger.snapshot().faults[0]).toMatchObject({
			strategy: "crash",
			anchor: "crash after payment#1",
		});
		expect(armed.outcomes()[0]).toMatchObject({ triggered: true, faultId: "F1" });
		await expect(charge("o-2")).rejects.toBeInstanceOf(CrashSignal);
		expect(providerCalls).toEqual(["o-1"]);
	});

	it("before: crashes without calling the provider", async () => {
		const { ledger, persistence, env, charge, providerCalls } = setup();
		new FaultController().arm([fault.crashBefore("payment")], env);
		await expect(charge("o-1")).rejects.toBeInstanceOf(CrashSignal);
		expect(providerCalls).toEqual([]);
		expect(ledger.attempts()).toHaveLength(0);
		expect(persistence.crashed).toBe(true);
	});

	it("matches the configured occurrence across runs and identity anchors", async () => {
		const { ledger, persistence, env, charge } = setup();
		new FaultController().arm(
			[
				{
					strategy: "crash",
					anchor: { type: "effect", identity: "payment::o-2", occurrence: 1 },
					point: "after",
				},
			],
			env,
		);
		await charge("o-1");
		ledger.endRun("yielded");
		ledger.beginRun();
		await expect(charge("o-2")).rejects.toBeInstanceOf(CrashSignal);
		expect(persistence.crashed).toBe(true);
		expect(ledger.snapshot().faults[0]?.runIndex).toBe(1);
	});

	it("does not trigger after a failed attempt (the effect never applied)", async () => {
		const ledger = new EffectLedger();
		ledger.beginRun();
		const persistence = new FakePersistence();
		const armed = new FaultController().arm([fault.crashAfter("payment")], {
			ledger,
			persistence,
			sleeper: manualSleeper(),
			processIsolated: false,
		});
		const failing = instrument(
			ledger,
			async () => {
				throw new Error("card declined");
			},
			{ kind: "payment" },
		);
		await expect(failing()).rejects.toThrow("card declined");
		expect(persistence.crashed).toBe(false);
		expect(armed.outcomes()[0]?.triggered).toBe(false);
	});

	it("ignores late completions from earlier runs", async () => {
		const ledger = new EffectLedger();
		const persistence = new FakePersistence();
		ledger.beginRun();
		new FaultController().arm([fault.crashAfter("payment")], {
			ledger,
			persistence,
			sleeper: manualSleeper(),
			processIsolated: false,
		});
		let release: () => void = () => undefined;
		const slow = instrument(ledger, () => new Promise<void>((r) => (release = r)), {
			kind: "payment",
		});
		const pending = slow();
		await new Promise((r) => setTimeout(r, 0));
		ledger.endRun("crashed");
		ledger.beginRun();
		release();
		await pending;
		expect(persistence.crashed).toBe(false);
	});

	it("at write N: crashes before the Nth durable write", () => {
		const { ledger, persistence, env } = setup();
		const armed = new FaultController().arm([fault.crashAtWrite(3)], env);
		persistence.write();
		persistence.write();
		expect(() => persistence.write()).toThrow(CrashSignal);
		expect(persistence.crashed).toBe(true);
		expect(ledger.isRunDead()).toBe(true);
		expect(ledger.snapshot().faults[0]?.anchor).toBe("crash at durable write #3");
		expect(armed.outcomes()[0]?.triggered).toBe(true);
		armed.dispose();
		persistence.restart();
		persistence.write();
		expect(persistence.writeCount).toBe(4);
	});
});
