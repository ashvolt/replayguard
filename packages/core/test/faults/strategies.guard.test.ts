import { describe, expect, it } from "vitest";
import { crashStrategy } from "../../src/faults/strategies/crash.js";
import { delayStrategy } from "../../src/faults/strategies/delay.js";
import { noneStrategy } from "../../src/faults/strategies/none.js";
import { throwAfterStrategy } from "../../src/faults/strategies/throw-after.js";
import { fault } from "../../src/faults/types.js";
import { EffectLedger } from "../../src/ledger/ledger.js";
import { manualSleeper } from "../../src/ports/sleeper.js";
import { FakePersistence } from "../support/fake-persistence.js";

const env = () => ({
	ledger: new EffectLedger(),
	persistence: new FakePersistence(),
	sleeper: manualSleeper(),
	processIsolated: false,
});

describe("strategy guards", () => {
	it.each([
		[crashStrategy, fault.delay("p", 1)],
		[throwAfterStrategy, fault.crashAfter("p")],
		[delayStrategy, fault.loseResponse("p")],
	])("%o refuses a spec for another strategy", (strategy, spec) => {
		expect(() => strategy.arm(spec, env(), 0)).toThrow(TypeError);
	});

	it("none never fires and disposes cleanly", () => {
		const armed = noneStrategy.arm(fault.none(), env(), 3);
		armed.dispose();
		expect(armed.outcome()).toEqual({ specIndex: 3, strategy: "none", triggered: false });
	});

	it("manual sleeper wakes equal-time sleeps in call order", async () => {
		const sleeper = manualSleeper();
		const order: number[] = [];
		void sleeper.sleep(5).then(() => order.push(1));
		void sleeper.sleep(5).then(() => order.push(2));
		void sleeper.sleep(5).then(() => order.push(3));
		await sleeper.advance(5);
		expect(order).toEqual([1, 2, 3]);
	});
});
