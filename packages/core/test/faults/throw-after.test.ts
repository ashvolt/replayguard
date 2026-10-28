import { describe, expect, it } from "vitest";
import { FaultController } from "../../src/faults/controller.js";
import { SimulatedNetworkError } from "../../src/faults/errors.js";
import { fault } from "../../src/faults/types.js";
import { instrument } from "../../src/instrument/instrument.js";
import { EffectLedger } from "../../src/ledger/ledger.js";
import { manualSleeper } from "../../src/ports/sleeper.js";
import { FakePersistence } from "../support/fake-persistence.js";

function setup() {
	const ledger = new EffectLedger();
	ledger.beginRun();
	const persistence = new FakePersistence();
	return {
		ledger,
		persistence,
		env: { ledger, persistence, sleeper: manualSleeper(), processIsolated: false },
	};
}

describe("throwAfter strategy (lost request / lost response)", () => {
	it("before: the request is lost, the provider is never called, nothing is recorded", async () => {
		const { ledger, persistence, env } = setup();
		const armed = new FaultController().arm([fault.loseRequest("email")], env);
		let called = false;
		const send = instrument(
			ledger,
			async () => {
				called = true;
			},
			{ kind: "email" },
		);
		await expect(send()).rejects.toBeInstanceOf(SimulatedNetworkError);
		expect(called).toBe(false);
		expect(ledger.attempts()).toHaveLength(0);
		expect(persistence.crashed).toBe(false);
		expect(ledger.snapshot().faults[0]?.anchor).toBe("lost request before email#1");
		expect(armed.outcomes()[0]?.triggered).toBe(true);
		await send();
		expect(called).toBe(true);
	});

	it("before: honors a custom error factory", async () => {
		const { ledger, env } = setup();
		const custom = new Error("DNS failure");
		new FaultController().arm([fault.loseRequest("email", 1, () => custom)], env);
		const send = instrument(ledger, async () => 1, { kind: "email" });
		await expect(send()).rejects.toBe(custom);
	});

	it("applies the effect then throws a simulated network error", async () => {
		const { ledger, persistence, env } = setup();
		new FaultController().arm([fault.loseResponse("email")], env);
		const send = instrument(ledger, async () => "id-1", { kind: "email" });
		const error = await send().catch((e: unknown) => e);
		expect(error).toBeInstanceOf(SimulatedNetworkError);
		expect((error as SimulatedNetworkError).code).toBe("ECONNRESET");
		expect(ledger.attempts()[0]?.status).toBe("applied");
		expect(persistence.crashed).toBe(false);
		expect(ledger.isRunDead()).toBe(false);
		expect(ledger.snapshot().faults[0]).toMatchObject({
			strategy: "throwAfter",
			anchor: "lost response after email#1",
		});
	});

	it("uses a custom error factory", async () => {
		const { ledger, env } = setup();
		const custom = new Error("504 gateway timeout");
		new FaultController().arm([fault.loseResponse("email", 1, () => custom)], env);
		const send = instrument(ledger, async () => "id-1", { kind: "email" });
		await expect(send()).rejects.toBe(custom);
	});

	it("also fires on deduplicated attempts and not on failed ones", async () => {
		const { ledger, env } = setup();
		const armed = new FaultController().arm([fault.loseResponse("payment", 2)], env);
		let n = 0;
		const charge = instrument(
			ledger,
			async () => {
				n++;
				if (n === 1) throw new Error("declined");
				return { replayed: true };
			},
			{ kind: "payment", isDeduplicated: (r) => r.replayed },
		);
		await expect(charge()).rejects.toThrow("declined");
		await expect(charge()).rejects.toBeInstanceOf(SimulatedNetworkError);
		expect(armed.outcomes()[0]?.triggered).toBe(true);
	});
});
