import { CrashSignal, type PersistenceControl } from "@replayguard/core";
import type { EngineDriver, KVEntry, KVWrite, WorkflowMessageDriver } from "@rivet-dev/workflows";

/**
 * Decorator over any Rivet `EngineDriver` that lets fault strategies crash durable storage
 * (Decorator pattern — Rivet itself is never patched). While crashed, every storage operation
 * rejects with `CrashSignal`, exactly as if the host process had died.
 *
 * @example
 * const inner = new InMemoryDriver();
 * const driver = new FaultyDriver(inner);
 * new FaultController().arm([fault.crashAtWrite(3)], { ledger, persistence: driver, sleeper, processIsolated: false });
 * await runWorkflow("wf", workflow, input, driver).result;
 */
export class FaultyDriver implements EngineDriver, PersistenceControl {
	readonly #inner: EngineDriver;
	readonly #listeners = new Set<(index: number) => void>();
	#crashed = false;
	#writes = 0;
	/** Mirrors the inner driver's atomic batch requirement when it declares one. */
	declare readonly atomicBatch?: boolean;

	constructor(inner: EngineDriver) {
		this.#inner = inner;
		if (inner.atomicBatch !== undefined) {
			Object.defineProperty(this, "atomicBatch", { value: inner.atomicBatch, enumerable: true });
		}
	}

	/** Poll interval of the inner driver. */
	get workerPollInterval(): number {
		return this.#inner.workerPollInterval;
	}

	/** Message driver of the inner driver. */
	get messageDriver(): WorkflowMessageDriver {
		return this.#inner.messageDriver;
	}

	/** Whether storage is unavailable because of a simulated crash. */
	get crashed(): boolean {
		return this.#crashed;
	}

	/** Durable writes attempted so far (index of the last write). */
	get writeCount(): number {
		return this.#writes;
	}

	/** Simulates process death: all storage operations fail until `restart()`. */
	crash(): void {
		this.#crashed = true;
	}

	/** Models a new process on the same durable storage. */
	restart(): void {
		this.#crashed = false;
	}

	/** Registers a listener called before each durable write; throwing aborts the write. */
	onBeforeWrite(listener: (index: number) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Reads a key (fails while crashed). */
	async get(key: Uint8Array): Promise<Uint8Array | null> {
		this.#alive();
		return this.#inner.get(key);
	}

	/** Lists a prefix (fails while crashed). */
	async list(prefix: Uint8Array): Promise<KVEntry[]> {
		this.#alive();
		return this.#inner.list(prefix);
	}

	/** Durable write. */
	async set(key: Uint8Array, value: Uint8Array): Promise<void> {
		this.#write();
		return this.#inner.set(key, value);
	}

	/** Durable write. */
	async delete(key: Uint8Array): Promise<void> {
		this.#write();
		return this.#inner.delete(key);
	}

	/** Durable write. */
	async deletePrefix(prefix: Uint8Array): Promise<void> {
		this.#write();
		return this.#inner.deletePrefix(prefix);
	}

	/** Durable write. */
	async deleteRange(start: Uint8Array, end: Uint8Array): Promise<void> {
		this.#write();
		return this.#inner.deleteRange(start, end);
	}

	/** Durable write. */
	async batch(writes: KVWrite[]): Promise<void> {
		this.#write();
		return this.#inner.batch(writes);
	}

	/** Durable write (alarm state). */
	async setAlarm(workflowId: string, wakeAt: number): Promise<void> {
		this.#write();
		return this.#inner.setAlarm(workflowId, wakeAt);
	}

	/** Durable write (alarm state). */
	async clearAlarm(workflowId: string): Promise<void> {
		this.#write();
		return this.#inner.clearAlarm(workflowId);
	}

	/** Forwards message waiting to the inner driver. */
	waitForMessages(messageNames: string[], abortSignal: AbortSignal): Promise<void> {
		return this.#inner.waitForMessages(messageNames, abortSignal);
	}

	#alive(): void {
		if (this.#crashed) throw new CrashSignal("durable storage unavailable: the process crashed");
	}

	#write(): void {
		this.#alive();
		const index = ++this.#writes;
		for (const listener of this.#listeners) listener(index);
	}
}
