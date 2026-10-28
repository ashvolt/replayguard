import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import YAML from "yaml";
import { type DiagramSource, DiagramValidationError, validateSource } from "./schema.ts";

export interface DiscoveredFeature {
	feature: string;
	/** Directory that holds diagram.yaml and receives `diagrams/` output. */
	dir: string;
	sourcePath: string;
	hasSource: boolean;
	tasksPath: string;
	hasTasks: boolean;
	/** Architecture sources carry no task IDs and are exempt from traceability checks. */
	taskChecked: boolean;
}

export function findRepoRoot(start: string): string {
	let dir = start;
	for (;;) {
		if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
		const parent = dirname(dir);
		if (parent === dir) throw new Error(`no pnpm-workspace.yaml found above ${start}`);
		dir = parent;
	}
}

const FEATURE_DIR = /^\d{3}-[a-z0-9-]+$/;

export function discoverSources(root: string, only?: string): DiscoveredFeature[] {
	const found: DiscoveredFeature[] = [];
	const specs = join(root, "specs");
	if (existsSync(specs)) {
		for (const name of readdirSync(specs).sort()) {
			const dir = join(specs, name);
			if (!FEATURE_DIR.test(name) || !statSync(dir).isDirectory()) continue;
			const sourcePath = join(dir, "diagram.yaml");
			const tasksPath = join(dir, "tasks.md");
			found.push({
				feature: name,
				dir,
				sourcePath,
				hasSource: existsSync(sourcePath),
				tasksPath,
				hasTasks: existsSync(tasksPath),
				taskChecked: true,
			});
		}
	}
	const archDir = join(root, "docs", "architecture");
	const archSource = join(archDir, "diagram.yaml");
	if (existsSync(archSource)) {
		found.push({
			feature: "architecture",
			dir: archDir,
			sourcePath: archSource,
			hasSource: true,
			tasksPath: join(archDir, "tasks.md"),
			hasTasks: false,
			taskChecked: false,
		});
	}
	return only === undefined ? found : found.filter((f) => f.feature === only);
}

/** Parses and validates a diagram.yaml file. `displayPath` is used in error messages. */
export function loadSource(
	path: string,
	expectedFeature: string,
	displayPath: string,
): DiagramSource {
	const doc = YAML.parseDocument(readFileSync(path, "utf8"));
	if (doc.errors.length > 0) {
		throw new DiagramValidationError(
			doc.errors.map((e) => `${displayPath}: ${e.message.split("\n")[0]}`),
		);
	}
	return validateSource(doc.toJS(), displayPath, expectedFeature);
}
