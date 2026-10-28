import { ExportError } from "./errors.ts";
import type { ParsedSpec } from "./parse/spec.ts";
import type { ParsedTask } from "./parse/tasks.ts";

export type ItemType = "Epic" | "Story" | "Task" | "Sub-task";
export type Priority = "High" | "Medium" | "Low";

/** Tracker-neutral backlog entry; every exporter renders from this shape. */
export interface BacklogItem {
	sourceId: string;
	type: ItemType;
	title: string;
	description: string;
	parentSourceId: string | null;
	labels: string[];
	priority: Priority;
	status: "To Do" | "Done";
	feature: string;
	source: { file: string; line: number };
}

export interface FeatureInput {
	feature: string;
	spec: ParsedSpec;
	tasks: ParsedTask[];
}

const MAX_TITLE = 255;

export function priorityOf(p: number): Priority {
	return p <= 1 ? "High" : p === 2 ? "Medium" : "Low";
}

function title(text: string): string {
	return text.length <= MAX_TITLE ? text : `${text.slice(0, MAX_TITLE - 1)}…`;
}

/**
 * Builds the ordered backlog: per feature an Epic, its Stories, then tasks (parents always first).
 *
 * @example
 * const items = buildBacklog([{ feature, spec: parseSpec(md, f), tasks: parseTasks(md2, f2) }]);
 */
export function buildBacklog(features: readonly FeatureInput[]): BacklogItem[] {
	const items: BacklogItem[] = [];
	for (const { feature, spec, tasks } of features) {
		const specFile = `specs/${feature}/spec.md`;
		const tasksFile = `specs/${feature}/tasks.md`;
		const epicPriority = priorityOf(Math.min(1, ...spec.stories.map((s) => s.priority)));
		items.push({
			sourceId: feature,
			type: "Epic",
			title: title(`${feature.slice(0, 3)} ${spec.title}`),
			description: `${spec.title} (${feature}).\n\nSource: ${specFile}:1`,
			parentSourceId: null,
			labels: [feature],
			priority: epicPriority,
			status: tasks.length > 0 && tasks.every((t) => t.done) ? "Done" : "To Do",
			feature,
			source: { file: specFile, line: 1 },
		});
		const storyPriority = new Map<number, Priority>();
		for (const story of spec.stories) {
			const priority = priorityOf(story.priority);
			storyPriority.set(story.number, priority);
			const storyTasks = tasks.filter((t) => t.story === story.number);
			items.push({
				sourceId: `${feature}-US${story.number}`,
				type: "Story",
				title: title(`US${story.number}: ${story.title}`),
				description: `User story ${story.number} (P${story.priority}) of ${feature}.\n\nSource: ${specFile}:${story.line}`,
				parentSourceId: feature,
				labels: [feature, `us${story.number}`],
				priority,
				status: storyTasks.length > 0 && storyTasks.every((t) => t.done) ? "Done" : "To Do",
				feature,
				source: { file: specFile, line: story.line },
			});
		}
		for (const task of tasks) {
			let parent = feature;
			let priority: Priority = "Medium";
			if (task.story !== null) {
				const p = storyPriority.get(task.story);
				if (p === undefined) {
					throw new ExportError(
						`${tasksFile}:${task.line}: task ${task.id} references US${task.story}, which is not in spec.md`,
					);
				}
				parent = `${feature}-US${task.story}`;
				priority = p;
			}
			items.push({
				sourceId: `${feature}-${task.id}`,
				type: task.story === null ? "Task" : "Sub-task",
				title: title(`${task.id} ${task.description}`),
				description: `${task.description}\n\nPhase: ${task.phaseTitle}\n\nSource: ${tasksFile}:${task.line}`,
				parentSourceId: parent,
				labels: [feature, task.phase, ...(task.parallel ? ["parallel"] : [])],
				priority,
				status: task.done ? "Done" : "To Do",
				feature,
				source: { file: tasksFile, line: task.line },
			});
		}
	}
	return items;
}
