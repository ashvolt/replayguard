import { describe, expect, it } from "vitest";
import type { DiagramSource } from "../src/schema.ts";
import { checkTrace, collectTrace, parseTaskIds } from "../src/trace.ts";

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
				{ id: "a", label: "A", shape: "box", tasks: ["T001", "T002"] },
				{ id: "b", label: "B", shape: "box", tasks: ["T050"] },
			],
			edges: [],
		},
		{
			kind: "workflow",
			title: "W",
			layout: "sequence",
			actors: [
				{ id: "x", label: "X" },
				{ id: "y", label: "Y" },
			],
			messages: [{ from: "x", to: "y", label: "call", tasks: ["T001"], style: "solid" }],
		},
	],
};

describe("trace", () => {
	it("parses checklist task ids in order, ignoring non-task lines", () => {
		const md = [
			"# Tasks",
			"- [ ] T001 Do a in a.ts",
			"- [x] T002 [P] Do b in b.ts",
			"- [X] T003 [US1] Do c in c.ts",
			"  - [ ] T999 nested is ignored",
			"Text mentioning T004 is ignored",
			"- [ ] T0045 four digits allowed in d.ts",
		].join("\n");
		expect(parseTaskIds(md)).toEqual(["T001", "T002", "T003", "T0045"]);
	});

	it("collects which diagrams and elements reference each task", () => {
		const trace = collectTrace(source);
		expect(trace.get("T001")).toEqual([
			{ kind: "hld", element: "A" },
			{ kind: "workflow", element: "call" },
		]);
		expect(trace.get("T050")).toEqual([{ kind: "hld", element: "B" }]);
	});

	it("reports untraced and unknown tasks", () => {
		expect(checkTrace(["T001", "T002", "T003"], source)).toEqual({
			untraced: ["T003"],
			unknown: ["T050"],
		});
	});

	it("is clean when sets match", () => {
		expect(checkTrace(["T001", "T002", "T050"], source)).toEqual({ untraced: [], unknown: [] });
	});
});
