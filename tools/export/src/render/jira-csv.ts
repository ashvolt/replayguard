import type { BacklogItem } from "../model.ts";
import { toCsv } from "./csv.ts";

/**
 * Jira Cloud CSV importer format. Rows are numbered (`Issue Id`) and linked by `Parent Id`;
 * the stable source ID is the last line of each description.
 */
export function renderJiraCsv(items: readonly BacklogItem[]): string {
	const number = new Map(items.map((item, i) => [item.sourceId, String(i + 1)]));
	const labelColumns = Math.max(1, ...items.map((i) => i.labels.length));
	const header = [
		"Issue Id",
		"Parent Id",
		"Issue Type",
		"Summary",
		"Description",
		"Priority",
		"Status",
		...Array.from({ length: labelColumns }, () => "Labels"),
	];
	const rows = items.map((item) => [
		number.get(item.sourceId) as string,
		item.parentSourceId === null ? "" : (number.get(item.parentSourceId) as string),
		item.type,
		item.title,
		`${item.description}\nReplayGuard-ID: ${item.sourceId}`,
		item.priority,
		item.status,
		...Array.from({ length: labelColumns }, (_, i) => item.labels[i] ?? ""),
	]);
	return toCsv([header, ...rows]);
}
