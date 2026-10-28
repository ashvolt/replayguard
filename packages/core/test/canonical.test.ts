import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/errors.js";
import { canonicalHash, canonicalize, fnv1a64 } from "../src/ledger/canonical.js";

describe("canonicalize", () => {
	it("sorts object keys and omits undefined properties", () => {
		expect(canonicalize({ b: 1, a: [1, undefined], c: undefined })).toBe('{"a":[1,null],"b":1}');
	});

	it("encodes special values distinctly", () => {
		expect(canonicalize([Number.NaN, Number.POSITIVE_INFINITY, -0, null, true, "x"])).toBe(
			'[{"$num":"NaN"},{"$num":"Infinity"},0,null,true,"x"]',
		);
		expect(canonicalize(new Date("2026-01-02T03:04:05.000Z"))).toBe(
			'{"$date":"2026-01-02T03:04:05.000Z"}',
		);
		expect(
			canonicalize(
				new Map([
					["b", 2],
					["a", 1],
				]),
			),
		).toBe('{"$map":[["a",1],["b",2]]}');
		expect(canonicalize(new Set([2, 1]))).toBe('{"$set":[1,2]}');
		expect(canonicalize(new Uint8Array([1, 2]))).toBe('{"$bytes":[1,2]}');
		expect(canonicalize(/a+/gi)).toBe('{"$regexp":"/a+/gi"}');
		expect(canonicalize(undefined)).toBe("null");
	});

	it("encodes raw ArrayBuffers and DataViews as bytes and orders map keys", () => {
		expect(canonicalize(new Uint8Array([3, 4]).buffer)).toBe('{"$bytes":[3,4]}');
		expect(canonicalize(new DataView(new Uint8Array([9, 8, 7]).buffer, 1, 1))).toBe(
			'{"$bytes":[8]}',
		);
		expect(
			canonicalize(
				new Map([
					["a", 2],
					["b", 1],
					["a2", 0],
				]),
			),
		).toBe('{"$map":[["a",2],["a2",0],["b",1]]}');
		expect(
			canonicalize(
				new Map([
					[1, "x"],
					[1, "y"],
				]),
			),
		).toBe('{"$map":[[1,"y"]]}');
	});

	it("uses toJSON when present", () => {
		expect(canonicalize({ toJSON: () => ({ z: 1, y: 2 }) })).toBe('{"y":2,"z":1}');
		expect(canonicalize(new URL("https://example.com/a"))).toBe('"https://example.com/a"');
	});

	it.each([
		["a function", [() => 1]],
		["a symbol", [Symbol("s")]],
		["a bigint", [1n]],
		["an invalid date", [new Date("nope")]],
	])("rejects %s as unhashable", (_label, value) => {
		try {
			canonicalize(value);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigError);
			expect((error as ConfigError).code).toBe("RG_CONFIG_UNHASHABLE");
		}
	});

	it("rejects cycles but allows shared references", () => {
		const shared = { x: 1 };
		expect(canonicalize([shared, shared])).toBe('[{"x":1},{"x":1}]');
		const cycle: Record<string, unknown> = {};
		cycle["self"] = cycle;
		expect(() => canonicalize(cycle)).toThrow(/cycle/);
	});
});

describe("canonicalHash", () => {
	it("is FNV-1a 64 over UTF-8 as 16 hex chars", () => {
		expect(fnv1a64("")).toBe("cbf29ce484222325");
		expect(fnv1a64("a")).toBe("af63dc4c8601ec8c");
		expect(canonicalHash(["x"])).toMatch(/^[0-9a-f]{16}$/);
	});

	it("is independent of key order and stable across calls", () => {
		fc.assert(
			fc.property(fc.dictionary(fc.string(), fc.jsonValue()), (obj) => {
				const reversed = Object.fromEntries(Object.entries(obj).reverse());
				expect(canonicalHash(reversed)).toBe(canonicalHash(obj));
				expect(canonicalHash(obj)).toBe(canonicalHash(structuredClone(obj)));
			}),
		);
	});

	it("distinguishes different JSON values", () => {
		fc.assert(
			fc.property(fc.jsonValue(), fc.jsonValue(), (a, b) => {
				fc.pre(canonicalize(a) !== canonicalize(b));
				expect(canonicalHash(a)).not.toBe(canonicalHash(b));
			}),
		);
	});
});
