#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { renderTraceability } from "./coverage.ts";
import { layoutDiagram } from "./layout/index.ts";
import { type DiscoveredFeature, discoverSources, findRepoRoot, loadSource } from "./load.ts";
import { renderExcalidraw } from "./render/excalidraw.ts";
import { renderSvg } from "./render/svg.ts";
import { type DiagramSource, DiagramValidationError } from "./schema.ts";
import { findStale } from "./stale.ts";
import { checkTrace, parseTaskIds } from "./trace.ts";

const USAGE = "usage: rg-diagrams <generate|check|coverage> [--feature <id>]\n";

export interface CliIo {
	cwd: string;
	write: (text: string) => void;
}

/** All generated files for one source, keyed by path relative to the feature directory. */
export function renderOutputs(
	source: DiagramSource,
	taskIds: readonly string[] | null,
): Map<string, string> {
	const outputs = new Map<string, string>();
	for (const def of source.diagrams) {
		const geometry = layoutDiagram(def, source.feature);
		outputs.set(`diagrams/${def.kind}.excalidraw`, renderExcalidraw(geometry));
		outputs.set(`diagrams/${def.kind}.svg`, renderSvg(geometry));
	}
	outputs.set("diagrams/TRACEABILITY.md", renderTraceability(source, taskIds));
	return outputs;
}

interface Loaded {
	feature: DiscoveredFeature;
	source: DiagramSource;
	taskIds: string[] | null;
}

function load(
	root: string,
	features: DiscoveredFeature[],
	io: CliIo,
): { loaded: Loaded[]; failed: boolean } {
	const loaded: Loaded[] = [];
	let failed = false;
	for (const feature of features) {
		if (!feature.hasSource) continue;
		const display = relative(root, feature.sourcePath).split("\\").join("/");
		try {
			const source = loadSource(feature.sourcePath, feature.feature, display);
			const taskIds = feature.hasTasks
				? parseTaskIds(readFileSync(feature.tasksPath, "utf8"))
				: null;
			loaded.push({ feature, source, taskIds });
		} catch (error) {
			if (!(error instanceof DiagramValidationError)) throw error;
			failed = true;
			for (const message of error.messages) io.write(`${message}\n`);
		}
	}
	return { loaded, failed };
}

function generate(root: string, features: DiscoveredFeature[], io: CliIo): number {
	const { loaded, failed } = load(root, features, io);
	for (const { feature, source, taskIds } of loaded) {
		for (const [rel, content] of renderOutputs(source, taskIds)) {
			const path = join(feature.dir, ...rel.split("/"));
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, content);
		}
		io.write(`generated ${feature.feature}\n`);
	}
	return failed ? 1 : 0;
}

function check(root: string, features: DiscoveredFeature[], io: CliIo): number {
	const { loaded, failed } = load(root, features, io);
	let ok = !failed;
	const byFeature = new Map(loaded.map((l) => [l.feature.feature, l]));
	for (const feature of features) {
		const entry = byFeature.get(feature.feature);
		if (!feature.hasSource) {
			if (feature.hasTasks) {
				ok = false;
				io.write(`✗ ${feature.feature}: missing diagram.yaml\n`);
			} else io.write(`- ${feature.feature}: skipped (no tasks.md yet)\n`);
			continue;
		}
		if (!entry) continue;
		const problems: string[] = [];
		const trace =
			feature.taskChecked && entry.taskIds
				? checkTrace(entry.taskIds, entry.source)
				: { untraced: [], unknown: [] };
		if (trace.untraced.length > 0) problems.push(`untraced ${trace.untraced.join(", ")}`);
		if (trace.unknown.length > 0) problems.push(`unknown ${trace.unknown.join(", ")}`);
		const stale = findStale(feature.dir, renderOutputs(entry.source, entry.taskIds));
		if (stale.length > 0) problems.push(`stale ${stale.join(", ")}`);
		if (problems.length > 0) {
			ok = false;
			io.write(`✗ ${feature.feature}: ${problems.join("; ")}\n`);
		} else if (feature.taskChecked && entry.taskIds) {
			io.write(
				`✓ ${feature.feature}: ${entry.taskIds.length}/${entry.taskIds.length} tasks traced\n`,
			);
		} else io.write(`✓ ${feature.feature}: diagrams fresh\n`);
	}
	return ok ? 0 : 1;
}

function coverage(root: string, features: DiscoveredFeature[], io: CliIo): number {
	const { loaded, failed } = load(root, features, io);
	io.write("| Feature | Tasks | Traced | Diagrams |\n|---------|-------|--------|----------|\n");
	for (const { feature, source, taskIds } of loaded) {
		const kinds = source.diagrams.map((d) => d.kind).join(", ");
		if (taskIds === null) {
			io.write(`| ${feature.feature} | — | — | ${kinds} |\n`);
			continue;
		}
		const { untraced } = checkTrace(taskIds, source);
		io.write(
			`| ${feature.feature} | ${taskIds.length} | ${taskIds.length - untraced.length} | ${kinds} |\n`,
		);
	}
	return failed ? 1 : 0;
}

/**
 * CLI entry; returns the process exit code.
 *
 * @example
 * process.exitCode = run(["check"], { cwd: process.cwd(), write: (s) => process.stdout.write(s) });
 */
export function run(argv: readonly string[], io: CliIo): number {
	const [command, ...rest] = argv;
	const flag = rest.indexOf("--feature");
	const only = flag >= 0 ? rest[flag + 1] : undefined;
	const commands = { generate, check, coverage } as const;
	if (command === undefined || !(command in commands)) {
		io.write(USAGE);
		return 2;
	}
	const root = findRepoRoot(io.cwd);
	return commands[command as keyof typeof commands](root, discoverSources(root, only), io);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = run(process.argv.slice(2), {
		cwd: process.cwd(),
		write: (s) => process.stdout.write(s),
	});
}
