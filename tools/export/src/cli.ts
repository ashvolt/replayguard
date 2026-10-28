#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { ExportError } from "./errors.ts";
import { type CommandPort, defaultCommand, githubTarget } from "./import/github.ts";
import { dryRunTarget, type ImportTarget, runImport } from "./import/importer.ts";
import { defaultHttp, type HttpPort, jiraTarget, readJiraEnv } from "./import/jira.ts";
import { ImportState } from "./import/state.ts";
import { type BacklogItem, buildBacklog, type FeatureInput } from "./model.ts";
import { parseSpec } from "./parse/spec.ts";
import { parseTasks } from "./parse/tasks.ts";
import { renderGenericCsv } from "./render/generic-csv.ts";
import { renderGithubPlan } from "./render/github.ts";
import { renderJiraCsv } from "./render/jira-csv.ts";
import { renderJiraJson } from "./render/jira-json.ts";

const USAGE =
	"usage: rg-export <generate|check|import-jira|import-github> [--feature <id>] [--apply] [--include-done] [--repo owner/name]\n";

export interface CliIo {
	cwd: string;
	env: Readonly<Record<string, string | undefined>>;
	write: (text: string) => void;
	http?: HttpPort;
	cmd?: CommandPort;
	sleep?: (ms: number) => Promise<void>;
}

function repoRoot(start: string): string {
	for (let dir = start; ; dir = dirname(dir)) {
		if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
		if (dirname(dir) === dir) throw new ExportError(`no pnpm-workspace.yaml found above ${start}`);
	}
}

function loadFeatures(root: string, only: string | undefined, io: CliIo): FeatureInput[] {
	const specs = join(root, "specs");
	const features: FeatureInput[] = [];
	for (const feature of readdirSync(specs).sort()) {
		const dir = join(specs, feature);
		if (!/^\d{3}-[a-z0-9-]+$/.test(feature) || !statSync(dir).isDirectory()) continue;
		if (only !== undefined && feature !== only) continue;
		const specFile = join(dir, "spec.md");
		if (!existsSync(specFile)) continue;
		const spec = parseSpec(readFileSync(specFile, "utf8"), `specs/${feature}/spec.md`);
		const tasksFile = join(dir, "tasks.md");
		const tasks = existsSync(tasksFile)
			? parseTasks(readFileSync(tasksFile, "utf8"), `specs/${feature}/tasks.md`)
			: [];
		if (!existsSync(tasksFile))
			io.write(`warning: ${feature} has no tasks.md; exporting epic and stories only\n`);
		features.push({ feature, spec, tasks });
	}
	return features;
}

/** Strategy registry: one renderer per export file. */
const RENDERERS: Record<string, (items: readonly BacklogItem[]) => string> = {
	"backlog.csv": renderGenericCsv,
	"github-issues.json": renderGithubPlan,
	"jira.csv": renderJiraCsv,
	"jira.json": renderJiraJson,
};

const render = (items: readonly BacklogItem[]) =>
	Object.entries(RENDERERS).map(([name, fn]) => [name, fn(items)] as const);

interface Flags {
	feature: string | undefined;
	apply: boolean;
	includeDone: boolean;
	repo: string | undefined;
}

function parseFlags(args: readonly string[]): Flags {
	const value = (flag: string) => {
		const i = args.indexOf(flag);
		return i >= 0 ? args[i + 1] : undefined;
	};
	return {
		feature: value("--feature"),
		apply: args.includes("--apply"),
		includeDone: args.includes("--include-done"),
		repo: value("--repo"),
	};
}

async function importWith(
	root: string,
	target: ImportTarget,
	items: BacklogItem[],
	flags: Flags,
	io: CliIo,
) {
	const result = await runImport(items, target, {
		apply: flags.apply,
		includeDone: flags.includeDone,
		state: ImportState.load(join(root, ".export-state", `${target.name}.json`)),
		log: (line) => io.write(`${line}\n`),
		...(io.sleep ? { sleep: io.sleep } : {}),
	});
	const summary = `${result.planned} planned, ${result.created} created, ${result.skipped} skipped`;
	io.write(flags.apply ? `applied: ${summary}\n` : `dry run: ${summary} (use --apply to create)\n`);
	return 0;
}

const COMMANDS: Record<string, (root: string, flags: Flags, io: CliIo) => Promise<number>> = {
	async generate(root, flags, io) {
		const items = buildBacklog(loadFeatures(root, flags.feature, io));
		mkdirSync(join(root, "exports"), { recursive: true });
		for (const [name, content] of render(items))
			writeFileSync(join(root, "exports", name), content);
		io.write(`wrote exports/ (${items.length} items)\n`);
		return 0;
	},
	async check(root, flags, io) {
		const items = buildBacklog(loadFeatures(root, flags.feature, io));
		const stale = render(items)
			.filter(([name, content]) => {
				const path = join(root, "exports", name);
				return !existsSync(path) || readFileSync(path, "utf8") !== content;
			})
			.map(([name]) => `exports/${name}`);
		if (stale.length > 0) {
			io.write(`stale: ${stale.join(", ")} — run pnpm export:generate\n`);
			return 1;
		}
		io.write(`exports are fresh (${items.length} items)\n`);
		return 0;
	},
	async "import-jira"(root, flags, io) {
		const items = buildBacklog(loadFeatures(root, flags.feature, io));
		const target: ImportTarget = flags.apply
			? jiraTarget(readJiraEnv(io.env), io.http ?? defaultHttp)
			: dryRunTarget("jira");
		return importWith(root, target, items, flags, io);
	},
	async "import-github"(root, flags, io) {
		if (flags.apply && flags.repo === undefined)
			throw new ExportError("--repo owner/name is required with --apply");
		const items = buildBacklog(loadFeatures(root, flags.feature, io));
		return importWith(
			root,
			githubTarget(flags.repo ?? "", io.cmd ?? defaultCommand),
			items,
			flags,
			io,
		);
	},
};

/**
 * CLI entry; resolves to the process exit code.
 *
 * @example
 * process.exitCode = await run(["generate"], { cwd: process.cwd(), env: process.env, write: console.log });
 */
export async function run(argv: readonly string[], io: CliIo): Promise<number> {
	const [command, ...rest] = argv;
	const handler = command === undefined ? undefined : COMMANDS[command];
	if (handler === undefined) {
		io.write(USAGE);
		return 2;
	}
	try {
		return await handler(repoRoot(io.cwd), parseFlags(rest), io);
	} catch (error) {
		if (!(error instanceof ExportError)) throw error;
		io.write(`${error.message}\n`);
		return 1;
	}
}

/* v8 ignore start -- entrypoint glue; run() is fully tested */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await run(process.argv.slice(2), {
		cwd: process.cwd(),
		env: process.env,
		write: (s) => process.stdout.write(s),
	});
}
/* v8 ignore stop */
