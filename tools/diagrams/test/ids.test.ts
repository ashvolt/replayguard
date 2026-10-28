import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createIdFactory, fnv1a32 } from "../src/ids.ts";

describe("ids", () => {
	it("hashes deterministically with FNV-1a", () => {
		expect(fnv1a32("")).toBe(0x811c9dc5);
		expect(fnv1a32("a")).toBe(0xe40c292c);
	});

	it("produces stable ids and seeds per namespace and key", () => {
		const a = createIdFactory("004/hld");
		const b = createIdFactory("004/hld");
		expect(a.id("node:x")).toBe(b.id("node:x"));
		expect(a.seed("node:x")).toBe(b.seed("node:x"));
		expect(a.id("node:x")).not.toBe(createIdFactory("004/lld").id("node:x"));
	});

	it("ids are 20 url-safe characters and seeds are positive 31-bit ints", () => {
		fc.assert(
			fc.property(fc.string(), fc.string(), (ns, key) => {
				const f = createIdFactory(ns);
				expect(f.id(key)).toMatch(/^[a-z0-9]{20}$/);
				const seed = f.seed(key);
				expect(Number.isInteger(seed)).toBe(true);
				expect(seed).toBeGreaterThan(0);
				expect(seed).toBeLessThan(2 ** 31);
			}),
		);
	});
});
