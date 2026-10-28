/**
 * Control over the durable storage a workflow runtime persists into. Implemented by runtime
 * adapters (e.g. `FaultyDriver`, which decorates Rivet's `EngineDriver`), used by fault strategies.
 *
 * @example
 * persistence.onBeforeWrite((index) => { if (index === 3) persistence.crash(); });
 */
export interface PersistenceControl {
	/** Simulates process death: every further storage operation fails until `restart()`. */
	crash(): void;
	/** Models a new process on the same durable storage; write counting continues. */
	restart(): void;
	/** Whether storage is currently unavailable because of a crash. */
	readonly crashed: boolean;
	/** Number of durable writes attempted so far (1-based index of the last write). */
	readonly writeCount: number;
	/** Called before each durable write with its 1-based index; throwing aborts that write. */
	onBeforeWrite(listener: (index: number) => void): () => void;
}
