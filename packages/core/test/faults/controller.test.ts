import { describe, expect, it } from "vitest";
import { ConfigError } from "../../src/errors.js";
import { FaultController } from "../../src/faults/controller.js";
import type { FaultStrategy } from "../../src/faults/strategy.js";
import { fault } from "../../src/faults/types.js";
import { instrument } from "../../src/instrument/instrument.js";
import { EffectLedger } from "../../src/ledger/ledger.js";
import { manualSleeper } from "../../src/ports/sleeper.js";
import { FakePersistence } from "../support/fake-persistence.js";

const env = () => ({
	ledger: new EffectLedger(),
	persistence: new FakePersistence(),
	sleeper: manualSleeper(),
	processIsolated: false,
});

describe("FaultController", () => {
	it("arms specs and reports outcomes in spec order", async () => {
		const e = env();
		e.ledger.beginRun();
		const armed = new FaultController().arm(
			[fault.none(), fault.loseResponse("email"), fault.crashAfter("payment")],
			e,
		);
		const send = instrument(e.ledger, async () => "sent", { kind: "email" });
		await expect(send()).rejects.toThrow(/lost response after email#1/);
		const outcomes = armed.outcomes();
		expect(outcomes.map((o) => [o.specIndex, o.strategy, o.triggered])).toEqual([
			[0, "none", false],
			[1, "throwAfter", true],
			[2, "crash", false],
		]);
		expect(outcomes[1]).toMatchObject({ faultId: "F1", runIndex: 0 });
		expect(typeof outcomes[1]?.at).toBe("number");
	});

	it("fires each fault at most once", async () => {
		const e = env();
		e.ledger.beginRun();
		new FaultController().arm([fault.loseResponse("email")], e);
		const send = instrument(e.ledger, async () => "sent", { kind: "email" });
		await expect(send()).rejects.toThrow();
		await expect(send()).resolves.toBe("sent");
	});

	it("dispose unregisters hooks", async () => {
		const e = env();
		const armed = new FaultController().arm([fault.loseResponse("email")], e);
		armed.dispose();
		const send = instrument(e.ledger, async () => "sent", { kind: "email" });
		await expect(send()).resolves.toBe("sent");
		expect(armed.outcomes()[0]?.triggered).toBe(false);
	});

	it("validates specs and requires registered strategies", () => {
		const controller = new FaultController();
		expect(() => controller.arm([{ strategy: "crash" } as never], env())).toThrow(ConfigError);
		expect(() => controller.arm([fault.killAfter("p")], env())).toThrow(
			'no fault strategy registered for "processKill"',
		);
	});

	it("rejects strategies that need process isolation on in-process runtimes", () => {
		const isolated: FaultStrategy = {
			name: "processKill",
			requiresProcessIsolation: true,
			arm: () => ({
				outcome: () => ({ specIndex: 0, strategy: "processKill", triggered: false }),
				dispose: () => undefined,
			}),
		};
		const controller = new FaultController([isolated]);
		expect(() => controller.arm([fault.killAfter("p")], env())).toThrow(
			/requires a process-isolated runtime/,
		);
		expect(
			controller.arm([fault.killAfter("p")], { ...env(), processIsolated: true }).outcomes(),
		).toHaveLength(1);
	});

	it("exposes the registered strategy names", () => {
		expect(new FaultController().strategyNames()).toEqual(["none", "crash", "throwAfter", "delay"]);
	});
});
