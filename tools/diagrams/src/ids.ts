/** 32-bit FNV-1a hash of a UTF-16 string (code units). */
export function fnv1a32(input: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash >>> 0;
}

export interface IdFactory {
	/** Stable 20-char element id for `key` within this namespace. */
	id(key: string): string;
	/** Stable positive 31-bit seed for `key` within this namespace. */
	seed(key: string): number;
}

/**
 * Deterministic ids so regenerated Excalidraw scenes are byte-identical.
 *
 * @example
 * const ids = createIdFactory("004-effect-ledger/hld");
 * ids.id("node:ledger"); // same value on every run
 */
export function createIdFactory(namespace: string): IdFactory {
	const part = (key: string, salt: string) =>
		fnv1a32(`${salt}\u0000${namespace}\u0000${key}`).toString(36).padStart(7, "0");
	return {
		id: (key) => `${part(key, "a")}${part(key, "b")}${part(key, "c")}`.slice(0, 20),
		seed: (key) => (fnv1a32(`seed\u0000${namespace}\u0000${key}`) % 2147483646) + 1,
	};
}
