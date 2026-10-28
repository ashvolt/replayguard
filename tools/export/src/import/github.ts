import { execFile } from "node:child_process";
import { ExportError } from "../errors.ts";
import type { BacklogItem } from "../model.ts";
import { githubLabels, milestoneTitles, sourceMarker } from "../render/github.ts";
import type { ImportTarget } from "./importer.ts";

/** Process port: runs a command with an argument array (never through a shell). */
export type CommandPort = (cmd: string, args: readonly string[]) => Promise<{ stdout: string }>;

export const defaultCommand: CommandPort = (cmd, args) =>
	new Promise((resolve, reject) => {
		execFile(cmd, [...args], { shell: false, maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
			if (error) reject(error);
			else resolve({ stdout });
		});
	});

const MARKER = /<!-- rg-source: (\S+) -->/;

export function githubTarget(repo: string, gh: CommandPort = defaultCommand): ImportTarget {
	let milestones = new Map<string, string>();
	return {
		name: "github",
		async prepare(items) {
			milestones = milestoneTitles(items);
			const labels = new Set(items.flatMap(githubLabels));
			for (const label of [...labels].sort()) {
				await gh("gh", ["label", "create", label, "--repo", repo, "--force"]);
			}
			const listed = await gh("gh", ["api", `repos/${repo}/milestones?state=all`, "--paginate"]);
			const existing = new Set(
				(JSON.parse(listed.stdout || "[]") as { title: string }[]).map((m) => m.title),
			);
			for (const title of new Set(milestones.values())) {
				if (!existing.has(title)) {
					await gh("gh", ["api", "-X", "POST", `repos/${repo}/milestones`, "-f", `title=${title}`]);
				}
			}
		},
		async existing() {
			const listed = await gh("gh", [
				"issue",
				"list",
				"--repo",
				repo,
				"--state",
				"all",
				"--limit",
				"5000",
				"--search",
				"rg-source in:body",
				"--json",
				"number,body",
			]);
			const found = new Map<string, string>();
			for (const issue of JSON.parse(listed.stdout || "[]") as { number: number; body: string }[]) {
				const match = MARKER.exec(issue.body);
				if (match?.[1]) found.set(match[1], `#${issue.number}`);
			}
			return found;
		},
		async create(item: BacklogItem, parentKey: string | null) {
			const parent = parentKey === null ? "" : `\n\nParent: ${parentKey}`;
			const args = [
				"issue",
				"create",
				"--repo",
				repo,
				"--title",
				item.title,
				"--body",
				`${item.description}${parent}\n\n${sourceMarker(item.sourceId)}`,
				"--label",
				githubLabels(item).join(","),
			];
			const milestone = milestones.get(item.feature);
			if (milestone !== undefined) args.push("--milestone", milestone);
			const { stdout } = await gh("gh", args);
			const number = /\/issues\/(\d+)\s*$/.exec(stdout.trim())?.[1];
			if (!number) throw new ExportError(`unexpected gh output: ${stdout.trim()}`);
			return `#${number}`;
		},
	};
}
