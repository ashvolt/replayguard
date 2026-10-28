import { ExportError } from "../errors.ts";

export interface ParsedStory {
	number: number;
	title: string;
	priority: number;
	/** 1-based line in spec.md. */
	line: number;
}

export interface ParsedSpec {
	title: string;
	stories: ParsedStory[];
}

const TITLE = /^# Feature Specification: (.+)$/;
const STORY = /^### User Story (\d+) - (.+?) \(Priority: P(\d+)\)\s*$/;

/** Extracts the feature title and prioritized user stories from a Spec Kit spec.md. */
export function parseSpec(markdown: string, file: string): ParsedSpec {
	const lines = markdown.split(/\r?\n/);
	const title = TITLE.exec(lines[0] as string)?.[1]?.trim();
	if (!title) throw new ExportError(`${file}:1: expected "# Feature Specification: <title>"`);
	const stories: ParsedStory[] = [];
	lines.forEach((text, i) => {
		const match = STORY.exec(text);
		if (!match) return;
		const number = Number(match[1]);
		if (stories.some((s) => s.number === number)) {
			throw new ExportError(`${file}:${i + 1}: duplicate user story ${number}`);
		}
		stories.push({
			number,
			title: (match[2] as string).trim(),
			priority: Number(match[3]),
			line: i + 1,
		});
	});
	return { title, stories };
}
