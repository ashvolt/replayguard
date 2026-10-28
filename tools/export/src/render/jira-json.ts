import type { BacklogItem } from "../model.ts";

/** Jira REST payload (consumed by `import-jira`); fields mirror `POST /rest/api/3/issue`. */
export function renderJiraJson(items: readonly BacklogItem[]): string {
	const payload = {
		version: 1,
		items: items.map((item) => ({
			sourceId: item.sourceId,
			parentSourceId: item.parentSourceId,
			status: item.status,
			fields: {
				issuetype: { name: item.type },
				summary: item.title,
				description: item.description,
				priority: { name: item.priority },
				labels: item.labels,
			},
		})),
	};
	return `${JSON.stringify(payload, null, 2)}\n`;
}
