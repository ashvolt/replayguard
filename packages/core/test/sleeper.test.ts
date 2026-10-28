import { describe, expect, it } from "vitest";
import { manualClock } from "../src/ports/clock.js";
import { manualSleeper, systemSleeper } from "../src/ports/sleeper.js";

describe("sleeper", () => {
	it("systemSleeper waits roughly the requested time and clamps negatives", async () => {
		const start = performance.now();
		await systemSleeper.sleep(15);
		expect(performance.now() - start).toBeGreaterThanOrEqual(10);
		await systemSleeper.sleep(-5);
	});

	it("manualSleeper resolves sleeps only when time advances past them, in order", async () => {
		const clock = manualClock(0);
		const sleeper = manualSleeper(clock);
		const woke: string[] = [];
		void sleeper.sleep(10).then(() => woke.push("a"));
		void sleeper.sleep(5).then(() => woke.push("b"));
		void sleeper.sleep(30).then(() => woke.push("c"));
		expect(sleeper.pending).toBe(3);
		await sleeper.advance(9);
		expect(woke).toEqual(["b"]);
		await sleeper.advance(1);
		expect(woke).toEqual(["b", "a"]);
		expect(clock.now()).toBe(10);
		await sleeper.advance(100);
		expect(woke).toEqual(["b", "a", "c"]);
		expect(sleeper.pending).toBe(0);
	});

	it("manualSleeper resolves zero-length sleeps on the next advance and owns a clock by default", async () => {
		const sleeper = manualSleeper();
		let done = false;
		void sleeper.sleep(0).then(() => {
			done = true;
		});
		await sleeper.advance(0);
		expect(done).toBe(true);
		expect(sleeper.clock.now()).toBe(0);
	});
});
