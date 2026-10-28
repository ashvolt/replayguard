import type { DiagramKind, DiagramSource } from "./schema.ts";

const TASK_LINE = /^- \[[ xX]\] (T\d{3,})\b/;

/** Task IDs from Spec Kit checklist lines (`- [ ] T001 ...`), in file order. */
export function parseTaskIds(markdown: string): string[] {
	const ids: string[] = [];
	for (const line of markdown.split(/\r?\n/)) {
		const match = TASK_LINE.exec(line);
		if (match?.[1]) ids.push(match[1]);
	}
	return ids;
}

export interface TraceRef {
	kind: DiagramKind;
	element: string;
}

/** Map of task ID → diagram elements referencing it, in diagram/element order. */
export function collectTrace(source: DiagramSource): Map<string, TraceRef[]> {
	const trace = new Map<string, TraceRef[]>();
	const add = (task: string, ref: TraceRef) => {
		const refs = trace.get(task) ?? [];
		refs.push(ref);
		trace.set(task, refs);
	};
	for (const diagram of source.diagrams) {
		const elements = diagram.layout === "flow" ? diagram.nodes : diagram.messages;
		for (const element of elements) {
			for (const task of element.tasks) add(task, { kind: diagram.kind, element: element.label });
		}
	}
	return trace;
}

export interface TraceResult {
	untraced: string[];
	unknown: string[];
}

export function checkTrace(taskIds: readonly string[], source: DiagramSource): TraceResult {
	const traced = collectTrace(source);
	const known = new Set(taskIds);
	return {
		untraced: taskIds.filter((id) => !traced.has(id)),
		unknown: [...traced.keys()].filter((id) => !known.has(id)).sort(),
	};
}
