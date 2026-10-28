import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Compares freshly generated outputs (relative path → content) with files on disk under `dir`.
 * Returns sorted relative paths that are missing, different, or orphaned in the same folders.
 */
export function findStale(dir: string, outputs: ReadonlyMap<string, string>): string[] {
	const stale = new Set<string>();
	const folders = new Set<string>();
	for (const [rel, content] of outputs) {
		folders.add(rel.split("/").slice(0, -1).join("/"));
		const path = join(dir, ...rel.split("/"));
		if (!existsSync(path) || readFileSync(path, "utf8").replace(/\r\n/g, "\n") !== content)
			stale.add(rel);
	}
	for (const folder of folders) {
		const abs = join(dir, ...folder.split("/"));
		if (!existsSync(abs)) continue;
		for (const name of readdirSync(abs)) {
			const rel = folder ? `${folder}/${name}` : name;
			if (statSync(join(abs, name)).isFile() && !outputs.has(rel)) stale.add(rel);
		}
	}
	return [...stale].sort();
}
