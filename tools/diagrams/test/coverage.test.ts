import { describe, expect, it } from "vitest";
import { renderTraceability } from "../src/coverage.ts";
import type { DiagramSource } from "../src/schema.ts";

const source: DiagramSource = {
	feature: "004-x",
	diagrams: [
		{
			kind: "hld",
			title: "H",
			layout: "flow",
			direction: "LR",
			groups: [],
			nodes: [
				{ id: "a", label: "A | pipe", shape: "box", tasks: ["T001"] },
				{ id: "b", label: "B", shape: "box", tasks: ["T001", "T002"] },
			],
			edges: [],
		},
	],
};

describe("renderTraceability", () => {
	it("renders a markdown table task -> kinds -> elements, escaping pipes", () => {
		const md = renderTraceability(source, ["T001", "T002", "T003"]);
		expect(md).toContain("# Traceability: 004-x");
		expect(md).toContain("| T001 | hld | A \\| pipe; B |");
		expect(md).toContain("| T002 | hld | B |");
		expect(md).toContain("| T003 | — | — (untraced) |");
		expect(md.endsWith("\n")).toBe(true);
	});

	it("renders a note when the source carries no tasks", () => {
		expect(
			renderTraceability({ ...source, feature: "architecture", diagrams: [] }, null),
		).toContain("No task references");
	});
});
