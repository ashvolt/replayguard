import { describe, expect, it } from "vitest";
import { FaultController } from "../../src/faults/controller.js";
import { fault } from "../../src/faults/types.js";
import { instrument } from "../../src/instrument/instrument.js";
import { EffectLedger } from "../../src/ledger/ledger.js";
import { manualClock } from "../../src/ports/clock.js";
import { manualSleeper } from "../../src/ports/sleeper.js";
import { FakePersistence } from "../support/fake-persistence.js";

describe("delay strategy (provider hang)", () => {
	it("holds only the targeted occurrence in flight for the configured time", async () => {
		const clock = manualClock();
		const sleeper = manualSleeper(clock);
		const ledger = new EffectLedger({ clock });
		ledger.beginRun();
		const armed = new FaultController().arm([fault.delay("payment", 500)], {
			ledger,
			persistence: new FakePersistence(),
			sleeper,
			processIsolated: false,
		});
		const providerCalls: number[] = [];
		const charge = instrument(ledger, async () => providerCalls.push(clock.now()), {
			kind: "payment",
		});

		const first = charge();
		await Promise.resolve();
		await Promise.resolve();
		expect(ledger.attempts()[0]?.status).toBe("started");
		expect(ledger.snapshot().faults[0]).toMatchObject({
			strategy: "delay",
			anchor: "delay 500ms in payment#1",
			inFlight: [1],
		});
		expect(providerCalls).toEqual([]);
		await charge();
		expect(providerCalls).toEqual([0]);
		await sleeper.advance(499);
		expect(ledger.attempts()[0]?.status).toBe("started");
		await sleeper.advance(1);
		await first;
		expect(providerCalls).toEqual([0, 500]);
		expect(ledger.attempts()[0]).toMatchObject({
			status: "applied",
			startedAt: 0,
			settledAt: 500,
			inFlightAtFaults: ["F1"],
		});
		expect(armed.outcomes()[0]).toMatchObject({ triggered: true, faultId: "F1" });
	});
});
