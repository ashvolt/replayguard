import type { KVEntry, KVWrite } from "@rivet-dev/workflows";
import { InMemoryDriver } from "@rivet-dev/workflows/testing";

const hex = (bytes: Uint8Array) =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Lexicographic byte order, as the engine requires for `list`. */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
	const n = Math.min(a.length, b.length);
	for (let i = 0; i < n; i++) {
		const d = (a[i] as number) - (b[i] as number);
		if (d !== 0) return d;
	}
	return a.length - b.length;
}

/** Plain-data copy of a driver's state. */
export interface DriverSnapshot {
	/** Values keyed by hex-encoded key. */
	kv: Record<string, Uint8Array>;
	/** Alarm wake times keyed by workflow ID. */
	alarms: Record<string, number>;
}

const startsWith = (key: Uint8Array, prefix: Uint8Array) =>
	key.length >= prefix.length && prefix.every((b, i) => key[i] === b);

/**
 * Fast in-memory `EngineDriver`: same semantics as Rivet's `InMemoryDriver` (whose message driver
 * it inherits) but without the per-operation timer that adds ~100 ms per run on some platforms.
 *
 * @example
 * await runWorkflow("wf", workflow, input, new FaultyDriver(new MemoryDriver())).result;
 */
export class MemoryDriver extends InMemoryDriver {
	readonly #kv = new Map<string, { key: Uint8Array; value: Uint8Array }>();
	readonly #alarms = new Map<string, number>();

	constructor() {
		super();
		this.latency = 0;
	}

	/** Reads a key. */
	override async get(key: Uint8Array): Promise<Uint8Array | null> {
		return this.#kv.get(hex(key))?.value ?? null;
	}

	/** Writes a copy of `value`. */
	override async set(key: Uint8Array, value: Uint8Array): Promise<void> {
		this.#kv.set(hex(key), { key: new Uint8Array(key), value: new Uint8Array(value) });
	}

	/** Deletes a key. */
	override async delete(key: Uint8Array): Promise<void> {
		this.#kv.delete(hex(key));
	}

	/** Deletes every key with the prefix. */
	override async deletePrefix(prefix: Uint8Array): Promise<void> {
		for (const [id, entry] of this.#kv) if (startsWith(entry.key, prefix)) this.#kv.delete(id);
	}

	/** Deletes keys in `[start, end)`. */
	override async deleteRange(start: Uint8Array, end: Uint8Array): Promise<void> {
		for (const [id, entry] of this.#kv) {
			if (compareBytes(entry.key, start) >= 0 && compareBytes(entry.key, end) < 0)
				this.#kv.delete(id);
		}
	}

	/** Lists entries with the prefix in lexicographic byte order. */
	override async list(prefix: Uint8Array): Promise<KVEntry[]> {
		return [...this.#kv.values()]
			.filter((entry) => startsWith(entry.key, prefix))
			.sort((a, b) => compareBytes(a.key, b.key))
			.map((entry) => ({ key: entry.key, value: entry.value }));
	}

	/** Writes copies of every entry. */
	override async batch(writes: KVWrite[]): Promise<void> {
		for (const { key, value } of writes) await this.set(key, value);
	}

	/** Records an alarm. */
	override async setAlarm(workflowId: string, wakeAt: number): Promise<void> {
		this.#alarms.set(workflowId, wakeAt);
	}

	/** Clears an alarm. */
	override async clearAlarm(workflowId: string): Promise<void> {
		this.#alarms.delete(workflowId);
	}

	/** Alarm time for a workflow. */
	override getAlarm(workflowId: string): number | undefined {
		return this.#alarms.get(workflowId);
	}

	/** Workflow IDs whose alarm time has passed. */
	override getDueAlarms(): string[] {
		const now = Date.now();
		return [...this.#alarms].filter(([, at]) => at <= now).map(([id]) => id);
	}

	/** Removes all data and alarms (messages are cleared by the base class). */
	override clear(): void {
		this.#kv.clear();
		this.#alarms.clear();
		super.clear();
	}

	/** Hex-keyed copy of all data and alarms. */
	override snapshot(): DriverSnapshot {
		return {
			kv: Object.fromEntries([...this.#kv].map(([id, e]) => [id, e.value])),
			alarms: Object.fromEntries(this.#alarms),
		};
	}

	/** Hex-encoded keys. */
	override keys(): string[] {
		return [...this.#kv.keys()];
	}
}
