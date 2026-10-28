import type { EngineDriver } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";

const enc = new TextEncoder();
const key = (s: string) => enc.encode(s);
const text = (b: Uint8Array | null) => (b === null ? null : new TextDecoder().decode(b));

/**
 * Behavioral contract every EngineDriver used by ReplayGuard must satisfy (FR-010).
 * Registers a describe block for the driver produced by `make`.
 */
export function driverConformance(name: string, make: () => Promise<EngineDriver>): void {
	describe(`EngineDriver conformance: ${name}`, () => {
		it("gets, sets and deletes values", async () => {
			const d = await make();
			expect(await d.get(key("a"))).toBeNull();
			await d.set(key("a"), key("1"));
			expect(text(await d.get(key("a")))).toBe("1");
			await d.set(key("a"), key("2"));
			expect(text(await d.get(key("a")))).toBe("2");
			await d.delete(key("a"));
			expect(await d.get(key("a"))).toBeNull();
		});

		it("lists by prefix in lexicographic byte order", async () => {
			const d = await make();
			for (const k of ["p/b", "p/a", "q/x", "p/aa", "pÿ"]) await d.set(key(k), key(k));
			const listed = (await d.list(key("p/"))).map((e) => text(e.key));
			expect(listed).toEqual(["p/a", "p/aa", "p/b"]);
		});

		it("deletes by prefix and by half-open range", async () => {
			const d = await make();
			for (const k of ["a/1", "a/2", "b/1", "c/1", "c/2", "d/1"]) await d.set(key(k), key("v"));
			await d.deletePrefix(key("a/"));
			await d.deleteRange(key("c/"), key("d/"));
			const all = (await d.list(new Uint8Array())).map((e) => text(e.key));
			expect(all).toEqual(["b/1", "d/1"]);
		});

		it("applies batches", async () => {
			const d = await make();
			await d.batch([
				{ key: key("x"), value: key("1") },
				{ key: key("y"), value: key("2") },
			]);
			expect([text(await d.get(key("x"))), text(await d.get(key("y")))]).toEqual(["1", "2"]);
		});

		it("accepts alarms and exposes scheduling settings", async () => {
			const d = await make();
			await d.setAlarm("wf", Date.now() + 1000);
			await d.clearAlarm("wf");
			expect(typeof d.workerPollInterval).toBe("number");
			expect(d.messageDriver).toBeDefined();
		});
	});
}
