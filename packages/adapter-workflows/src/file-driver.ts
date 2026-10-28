import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { KVWrite } from "@rivet-dev/workflows";
import { MemoryDriver } from "./memory-driver.js";

interface FileShape {
	version: 1;
	kv: Record<string, string>;
	alarms: Record<string, number>;
}

const fromHex = (hex: string) =>
	Uint8Array.from(hex.match(/../g) ?? [], (b) => Number.parseInt(b, 16));

/**
 * Persistent `EngineDriver` backed by `<dir>/kv.json`, rewritten atomically (temp file + rename)
 * after every write. Lets a killed process be restarted on the same durable state.
 *
 * @example
 * const driver = await FileDriver.open(storeDir);
 * await runWorkflow("wf", workflow, input, driver).result;
 */
export class FileDriver extends MemoryDriver {
	readonly #file: string;
	#loading = false;

	private constructor(dir: string) {
		super();
		this.#file = join(dir, "kv.json");
	}

	/** Opens (or creates) the store in `dir`. */
	static async open(dir: string): Promise<FileDriver> {
		mkdirSync(dir, { recursive: true });
		const driver = new FileDriver(dir);
		if (existsSync(driver.#file)) {
			const data = JSON.parse(readFileSync(driver.#file, "utf8")) as FileShape;
			if (data.version !== 1)
				throw new Error(`unsupported kv.json version ${String(data.version)}`);
			driver.#loading = true;
			for (const [hex, value] of Object.entries(data.kv)) {
				await driver.set(fromHex(hex), Uint8Array.from(Buffer.from(value, "base64")));
			}
			for (const [id, at] of Object.entries(data.alarms)) await driver.setAlarm(id, at);
			driver.#loading = false;
		}
		return driver;
	}

	/** Durable write. */
	override async set(key: Uint8Array, value: Uint8Array): Promise<void> {
		await super.set(key, value);
		this.#persist();
	}

	/** Durable write. */
	override async delete(key: Uint8Array): Promise<void> {
		await super.delete(key);
		this.#persist();
	}

	/** Durable write. */
	override async deletePrefix(prefix: Uint8Array): Promise<void> {
		await super.deletePrefix(prefix);
		this.#persist();
	}

	/** Durable write. */
	override async deleteRange(start: Uint8Array, end: Uint8Array): Promise<void> {
		await super.deleteRange(start, end);
		this.#persist();
	}

	/** Durable write of all entries as one file update. */
	override async batch(writes: KVWrite[]): Promise<void> {
		const loading = this.#loading;
		this.#loading = true;
		try {
			await super.batch(writes);
		} finally {
			this.#loading = loading;
		}
		this.#persist();
	}

	/** Durable alarm update. */
	override async setAlarm(workflowId: string, wakeAt: number): Promise<void> {
		await super.setAlarm(workflowId, wakeAt);
		this.#persist();
	}

	/** Durable alarm update. */
	override async clearAlarm(workflowId: string): Promise<void> {
		await super.clearAlarm(workflowId);
		this.#persist();
	}

	#persist(): void {
		if (this.#loading) return;
		const snap = this.snapshot();
		const data: FileShape = {
			version: 1,
			kv: Object.fromEntries(
				Object.entries(snap.kv).map(([k, v]) => [k, Buffer.from(v).toString("base64")]),
			),
			alarms: snap.alarms,
		};
		const tmp = `${this.#file}.tmp`;
		writeFileSync(tmp, JSON.stringify(data));
		renameSync(tmp, this.#file);
	}
}
