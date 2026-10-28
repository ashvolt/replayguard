import { describe, expect, it } from "vitest";
import { manualClock, systemClock } from "../src/ports/clock.js";

describe("clock", () => {
	it("systemClock is wall-clock aligned and monotonic", () => {
		const a = systemClock.now();
		const b = systemClock.now();
		expect(b).toBeGreaterThanOrEqual(a);
		expect(Math.abs(a - Date.now())).toBeLessThan(1_000);
	});

	it("manualClock advances and sets explicitly", () => {
		const clock = manualClock(100);
		expect(clock.now()).toBe(100);
		clock.advance(5);
		expect(clock.now()).toBe(105);
		clock.set(1);
		expect(clock.now()).toBe(1);
		expect(manualClock().now()).toBe(0);
	});

	it("manualClock rejects negative advances", () => {
		expect(() => manualClock().advance(-1)).toThrow("cannot advance by a negative duration");
	});
});
