import type { BacklogItem } from "../model.ts";

export const sourceMarker = (sourceId: string) => `<!-- rg-source: ${sourceId} -->`;

/** Labels used on GitHub: backlog labels plus the item type (e.g. `sub-task`). */
export const githubLabels = (item: BacklogItem) => [...item.labels, item.type.toLowerCase()];

/** Milestone title per feature: the feature's Epic title. */
export function milestoneTitles(items: readonly BacklogItem[]): Map<string, string> {
	return new Map(items.filter((i) => i.type === "Epic").map((i) => [i.feature, i.title]));
}

/** GitHub Issues plan: one milestone per feature, one issue per backlog item with a source marker. */
export function renderGithubPlan(items: readonly BacklogItem[]): string {
	const milestones = milestoneTitles(items);
	const plan = {
		version: 1,
		milestones: [...milestones].map(([feature, title]) => ({ feature, title })),
		issues: items.map((item) => ({
			sourceId: item.sourceId,
			parentSourceId: item.parentSourceId,
			type: item.type,
			milestone: milestones.get(item.feature),
			title: item.title,
			body: `${item.description}\n\n${sourceMarker(item.sourceId)}`,
			labels: githubLabels(item),
			status: item.status,
		})),
	};
	return `${JSON.stringify(plan, null, 2)}\n`;
}
