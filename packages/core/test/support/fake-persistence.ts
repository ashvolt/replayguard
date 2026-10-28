import { CrashSignal } from "../../src/errors.js";
import type { PersistenceControl } from "../../src/ports/persistence.js";

/** In-memory PersistenceControl double: `write()` simulates one durable write. */
export class FakePersistence implements PersistenceControl {
	crashed = false;
	writeCount = 0;
	readonly #listeners = new Set<(index: number) => void>();

	crash(): void {
		this.crashed = true;
	}

	restart(): void {
		this.crashed = false;
	}

	onBeforeWrite(listener: (index: number) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	write(): void {
		if (this.crashed) throw new CrashSignal("storage unavailable");
		this.writeCount++;
		for (const listener of this.#listeners) listener(this.writeCount);
	}
}
