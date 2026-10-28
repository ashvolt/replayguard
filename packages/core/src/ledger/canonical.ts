import { ConfigError } from "../errors.js";

const unhashable = (what: string) =>
	new ConfigError(
		`cannot hash ${what} in effect arguments; pass a \`subject\` function to instrument()`,
		"RG_CONFIG_UNHASHABLE",
	);

function encode(value: unknown, ancestors: Set<object>): string {
	switch (typeof value) {
		case "undefined":
			return "null";
		case "boolean":
		case "string":
			return JSON.stringify(value);
		case "number":
			return Number.isFinite(value) ? JSON.stringify(value) : `{"$num":"${String(value)}"}`;
		case "bigint":
		case "function":
		case "symbol":
			throw unhashable(`a ${typeof value}`);
	}
	if (value === null) return "null";
	const obj = value as object;
	if (ancestors.has(obj)) throw unhashable("a value with a cycle");
	ancestors.add(obj);
	try {
		return encodeObject(obj, ancestors);
	} finally {
		ancestors.delete(obj);
	}
}

function encodeObject(obj: object, ancestors: Set<object>): string {
	if (obj instanceof Date) {
		if (Number.isNaN(obj.getTime())) throw unhashable("an invalid Date");
		return `{"$date":${JSON.stringify(obj.toISOString())}}`;
	}
	if (obj instanceof RegExp) return `{"$regexp":${JSON.stringify(String(obj))}}`;
	if (obj instanceof Map) {
		const entries = [...obj].map(([k, v]) => [encode(k, ancestors), encode(v, ancestors)] as const);
		entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{"$map":[${entries.map(([k, v]) => `[${k},${v}]`).join(",")}]}`;
	}
	if (obj instanceof Set) {
		const items = [...obj].map((v) => encode(v, ancestors)).sort();
		return `{"$set":[${items.join(",")}]}`;
	}
	if (ArrayBuffer.isView(obj) || obj instanceof ArrayBuffer) {
		const bytes = ArrayBuffer.isView(obj)
			? new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength)
			: new Uint8Array(obj);
		return `{"$bytes":[${bytes.join(",")}]}`;
	}
	if (Array.isArray(obj)) return `[${obj.map((v) => encode(v, ancestors)).join(",")}]`;
	const toJSON = (obj as { toJSON?: unknown }).toJSON;
	if (typeof toJSON === "function") return encode(toJSON.call(obj), ancestors);
	const record = obj as Record<string, unknown>;
	const keys = Object.keys(record)
		.filter((k) => record[k] !== undefined)
		.sort();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${encode(record[k], ancestors)}`).join(",")}}`;
}

/**
 * Deterministic JSON-like encoding: sorted object keys, tagged Dates/Maps/Sets/bytes, distinct
 * NaN/Infinity. Functions, symbols, bigints, invalid dates and cycles throw `RG_CONFIG_UNHASHABLE`.
 *
 * @example
 * canonicalize({ b: 1, a: 2 }); // '{"a":2,"b":1}'
 */
export function canonicalize(value: unknown): string {
	return encode(value, new Set());
}

const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;
const utf8 = new TextEncoder();

/**
 * 64-bit FNV-1a over UTF-8 bytes, as 16 lowercase hex characters. Not cryptographic.
 *
 * @example
 * fnv1a64("a"); // "af63dc4c8601ec8c"
 */
export function fnv1a64(input: string): string {
	let hash = OFFSET;
	for (const byte of utf8.encode(input)) {
		hash ^= BigInt(byte);
		hash = (hash * PRIME) & MASK;
	}
	return hash.toString(16).padStart(16, "0");
}

/**
 * Stable short hash of any hashable value (used as the default effect subject).
 *
 * @example
 * canonicalHash(["order-1", 500]) === canonicalHash(["order-1", 500]); // true
 */
export function canonicalHash(value: unknown): string {
	return fnv1a64(canonicalize(value));
}
