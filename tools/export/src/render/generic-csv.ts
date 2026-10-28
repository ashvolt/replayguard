import type { BacklogItem } from "../model.ts";
import { toCsv } from "./csv.ts";

/** Flat CSV for Linear, Azure Boards and other generic importers. */
export function renderGenericCsv(items: readonly BacklogItem[]): string {
	const header = [
		"id",
		"parent_id",
		"type",
		"title",
		"description",
		"labels",
		"priority",
		"status",
		"feature",
	];
	const rows = items.map((item) => [
		item.sourceId,
		item.parentSourceId ?? "",
		item.type,
		item.title,
		item.description,
		item.labels.join(";"),
		item.priority,
		item.status,
		item.feature,
	]);
	return toCsv([header, ...rows]);
}
