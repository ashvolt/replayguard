import { ExportError } from "../errors.ts";

export interface ParsedTask {
	id: string;
	done: boolean;
	parallel: boolean;
	/** User story number from `[USn]`, or null for setup/foundational/polish tasks. */
	story: number | null;
	/** Normalized phase label: setup, foundational, usN, polish, or a slug. */
	phase: string;
	phaseTitle: string;
	description: string;
	line: number;
}

const PHASE = /^## (Phase \d+: (.+))$/;
const TASK = /^- \[( |x|X)\] (T\d{3,}) (\[P\] )?(\[US(\d+)\] )?(\S.*)$/;

function phaseLabel(name: string): string {
	const story = /^User Story (\d+)/i.exec(name);
	if (story) return `us${story[1]}`;
	if (/^Setup\b/i.test(name)) return "setup";
	if (/^Foundational\b/i.test(name)) return "foundational";
	if (/^Polish\b/i.test(name)) return "polish";
	return name
		.replace(/\(.*?\)/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Parses Spec Kit checklist task lines; malformed checklist lines fail with `file:line`. */
export function parseTasks(markdown: string, file: string): ParsedTask[] {
	const tasks: ParsedTask[] = [];
	const seen = new Set<string>();
	let phase: { label: string; title: string } | null = null;
	markdown.split(/\r?\n/).forEach((text, i) => {
		const line = i + 1;
		if (text.startsWith("## ")) {
			const match = PHASE.exec(text);
			phase = match ? { title: match[1] as string, label: phaseLabel(match[2] as string) } : null;
			return;
		}
		if (!text.startsWith("- [")) return;
		const match = TASK.exec(text);
		if (!match)
			throw new ExportError(`${file}:${line}: expected "- [ ] T### [P?] [USn?] description"`);
		if (phase === null) throw new ExportError(`${file}:${line}: task outside a phase`);
		const id = match[2] as string;
		if (seen.has(id)) throw new ExportError(`${file}:${line}: duplicate task id ${id}`);
		seen.add(id);
		tasks.push({
			id,
			done: match[1] !== " ",
			parallel: match[3] !== undefined,
			story: match[5] === undefined ? null : Number(match[5]),
			phase: phase.label,
			phaseTitle: phase.title,
			description: (match[6] as string).trim(),
			line,
		});
	});
	return tasks;
}
