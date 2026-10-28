import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Local record of created tracker issues (source ID → tracker key) for idempotent re-runs. */
export class ImportState {
	readonly #path: string;
	readonly #created: Map<string, string>;

	private constructor(path: string, created: Map<string, string>) {
		this.#path = path;
		this.#created = created;
	}

	static load(path: string): ImportState {
		if (!existsSync(path)) return new ImportState(path, new Map());
		const data = JSON.parse(readFileSync(path, "utf8")) as { created?: Record<string, string> };
		return new ImportState(path, new Map(Object.entries(data.created ?? {})));
	}

	get(sourceId: string): string | undefined {
		return this.#created.get(sourceId);
	}

	/** Records a created key and persists immediately, so a crash mid-import loses nothing. */
	record(sourceId: string, key: string): void {
		this.#created.set(sourceId, key);
		mkdirSync(dirname(this.#path), { recursive: true });
		writeFileSync(
			this.#path,
			`${JSON.stringify({ created: Object.fromEntries(this.#created) }, null, 2)}\n`,
		);
	}
}
