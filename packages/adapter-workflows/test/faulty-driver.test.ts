import { CrashSignal } from "@replayguard/core";
import { InMemoryDriver } from "@rivet-dev/workflows/testing";
import { describe, expect, it, vi } from "vitest";
import { FaultyDriver } from "../src/faulty-driver.js";
import { driverConformance } from "./driver-conformance.js";

const key = (s: string) => new TextEncoder().encode(s);

function memory(): InMemoryDriver {
	const inner = new InMemoryDriver();
	inner.latency = 0;
	return inner;
}

driverConformance("InMemoryDriver", async () => memory());
driverConformance("FaultyDriver(InMemoryDriver)", async () => new FaultyDriver(memory()));

describe("FaultyDriver", () => {
	it("passes reads and scheduling settings through", async () => {
		const inner = memory();
		await inner.set(key("k"), key("v"));
		const driver = new FaultyDriver(inner);
		expect(await driver.get(key("k"))).toEqual(key("v"));
		expect(driver.workerPollInterval).toBe(inner.workerPollInterval);
		expect(driver.messageDriver).toBe(inner.messageDriver);
		expect("atomicBatch" in driver).toBe(false);
		const atomic = Object.assign(memory(), { atomicBatch: true });
		expect(new FaultyDriver(atomic).atomicBatch).toBe(true);
	});

	it("counts every write operation and notifies listeners with the 1-based index", async () => {
		const driver = new FaultyDriver(memory());
		const seen: number[] = [];
		const off = driver.onBeforeWrite((i) => seen.push(i));
		await driver.set(key("a"), key("1"));
		await driver.delete(key("a"));
		await driver.deletePrefix(key("a"));
		await driver.deleteRange(key("a"), key("b"));
		await driver.batch([]);
		await driver.setAlarm("wf", 1);
		await driver.clearAlarm("wf");
		off();
		await driver.set(key("b"), key("2"));
		expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(driver.writeCount).toBe(8);
	});

	it("rejects every storage operation while crashed and recovers on restart", async () => {
		const driver = new FaultyDriver(memory());
		await driver.set(key("a"), key("1"));
		driver.crash();
		expect(driver.crashed).toBe(true);
		for (const op of [
			() => driver.get(key("a")),
			() => driver.list(key("")),
			() => driver.set(key("a"), key("2")),
			() => driver.batch([{ key: key("x"), value: key("y") }]),
			() => driver.delete(key("a")),
		]) {
			await expect(op()).rejects.toBeInstanceOf(CrashSignal);
		}
		driver.restart();
		expect(driver.crashed).toBe(false);
		expect(await driver.get(key("a"))).toEqual(key("1"));
		expect(driver.writeCount).toBe(1);
	});

	it("aborts the write when a listener throws", async () => {
		const driver = new FaultyDriver(memory());
		driver.onBeforeWrite((i) => {
			if (i === 2) throw new CrashSignal("boom");
		});
		await driver.set(key("a"), key("1"));
		await expect(driver.set(key("b"), key("2"))).rejects.toThrow("boom");
		expect(await driver.get(key("b"))).toBeNull();
	});

	it("forwards waitForMessages", async () => {
		const inner = memory();
		const spy = vi.spyOn(inner, "waitForMessages").mockResolvedValue(undefined);
		const driver = new FaultyDriver(inner);
		const signal = new AbortController().signal;
		await driver.waitForMessages(["go"], signal);
		expect(spy).toHaveBeenCalledWith(["go"], signal);
	});
});
