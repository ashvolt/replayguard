import { ExportError } from "../errors.ts";
import type { BacklogItem } from "../model.ts";
import type { ImportState } from "./state.ts";

/** Retryable failure (rate limit, 5xx). Any other error stops the import. */
export class TransientError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TransientError";
	}
}

/** Tracker-specific steps plugged into the import template. */
export interface ImportTarget {
	readonly name: string;
	/** One-time setup before creating issues (labels, milestones). Only called with `apply`. */
	prepare?(items: readonly BacklogItem[]): Promise<void>;
	/** Issues that already exist in the tracker, keyed by source ID. Only called with `apply`. */
	existing?(): Promise<Map<string, string>>;
	create(item: BacklogItem, parentKey: string | null): Promise<string>;
}

/** Placeholder target for dry runs: credentials are not required and nothing is ever created. */
export function dryRunTarget(name: string): ImportTarget {
	return {
		name,
		create: () => Promise.reject(new Error("dry-run target cannot create issues")),
	};
}

export interface ImportOptions {
	apply: boolean;
	includeDone: boolean;
	state: ImportState;
	log: (line: string) => void;
	sleep?: (ms: number) => Promise<void>;
	maxRetries?: number;
}

export interface ImportResult {
	planned: number;
	created: number;
	skipped: number;
}

/** Keeps open items plus any done item that still has an open descendant (parents must exist). */
function selectItems(items: readonly BacklogItem[], includeDone: boolean): BacklogItem[] {
	const keep = new Set<string>();
	for (let i = items.length - 1; i >= 0; i--) {
		const item = items[i] as BacklogItem;
		if (includeDone || item.status !== "Done" || keep.has(item.sourceId)) {
			keep.add(item.sourceId);
			if (item.parentSourceId !== null) keep.add(item.parentSourceId);
		}
	}
	return items.filter((item) => keep.has(item.sourceId));
}

async function withRetry<T>(
	fn: () => Promise<T>,
	sleep: (ms: number) => Promise<void>,
	maxRetries: number,
): Promise<T> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await fn();
		} catch (error) {
			if (!(error instanceof TransientError) || attempt >= maxRetries) throw error;
			await sleep(500 * 2 ** attempt);
		}
	}
}

/**
 * Template method shared by all trackers: select → (prepare, existing) → create parent-first →
 * persist state after each create. Dry run (default) never touches the target.
 */
export async function runImport(
	items: readonly BacklogItem[],
	target: ImportTarget,
	options: ImportOptions,
): Promise<ImportResult> {
	const selected = selectItems(items, options.includeDone);
	const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
	const known = new Map<string, string>();
	if (options.apply) {
		await target.prepare?.(selected);
		for (const [id, key] of (await target.existing?.()) ?? []) known.set(id, key);
	}
	const result: ImportResult = { planned: 0, created: 0, skipped: 0 };
	for (const item of selected) {
		const existing = options.state.get(item.sourceId) ?? known.get(item.sourceId);
		if (existing !== undefined) {
			known.set(item.sourceId, existing);
			result.skipped++;
			continue;
		}
		const under = item.parentSourceId === null ? "" : ` under ${item.parentSourceId}`;
		if (!options.apply) {
			options.log(`would create ${item.type} ${item.sourceId} "${item.title}"${under}`);
			result.planned++;
			continue;
		}
		const parentKey =
			item.parentSourceId === null ? null : (known.get(item.parentSourceId) ?? null);
		if (item.parentSourceId !== null && parentKey === null) {
			throw new ExportError(`parent ${item.parentSourceId} of ${item.sourceId} was not created`);
		}
		const key = await withRetry(
			() => target.create(item, parentKey),
			sleep,
			options.maxRetries ?? 5,
		);
		known.set(item.sourceId, key);
		options.state.record(item.sourceId, key);
		options.log(`created ${key} ← ${item.sourceId}`);
		result.created++;
	}
	return result;
}
