import { describe, expect, it } from "vitest";
import { layoutFlow } from "../src/layout/flow.ts";
import { layoutSequence } from "../src/layout/sequence.ts";
import { renderExcalidraw } from "../src/render/excalidraw.ts";

type El = Record<string, unknown> & { id: string; type: string };

const flowOut = layoutFlow(
	{
		kind: "hld",
		title: "Ledger",
		layout: "flow",
		direction: "LR",
		groups: [{ id: "g", label: "group" }],
		nodes: [
			{ id: "a", label: "A", shape: "box", tasks: ["T001"], group: "g" },
			{ id: "b", label: "B", shape: "diamond", tasks: [] },
		],
		edges: [{ from: "a", to: "b", style: "solid", label: "calls" }],
	},
	"004-x",
);

describe("renderExcalidraw", () => {
	const scene = JSON.parse(renderExcalidraw(flowOut)) as {
		type: string;
		version: number;
		source: string;
		elements: El[];
		appState: Record<string, unknown>;
		files: Record<string, unknown>;
	};
	const byId = new Map(scene.elements.map((e) => [e.id, e]));

	it("emits an Excalidraw v2 scene", () => {
		expect(scene.type).toBe("excalidraw");
		expect(scene.version).toBe(2);
		expect(scene.source).toBe("replayguard-diagrams");
		expect(scene.files).toEqual({});
		expect(scene.appState["viewBackgroundColor"]).toBe("#ffffff");
	});

	it("binds every container text to its shape and back", () => {
		const texts = scene.elements.filter((e) => e.type === "text" && e["containerId"]);
		expect(texts.length).toBeGreaterThanOrEqual(3);
		for (const text of texts) {
			const container = byId.get(text["containerId"] as string);
			expect(container).toBeDefined();
			expect(container?.["boundElements"]).toContainEqual({ type: "text", id: text.id });
			expect(text["originalText"]).toBe(text["text"]);
		}
	});

	it("binds arrows to both endpoints with matching boundElements", () => {
		const arrow = scene.elements.find((e) => e.type === "arrow") as El;
		const start = arrow["startBinding"] as { elementId: string };
		const end = arrow["endBinding"] as { elementId: string };
		expect(byId.get(start.elementId)?.["boundElements"]).toContainEqual({
			type: "arrow",
			id: arrow.id,
		});
		expect(byId.get(end.elementId)?.["boundElements"]).toContainEqual({
			type: "arrow",
			id: arrow.id,
		});
		const points = arrow["points"] as number[][];
		expect(points[0]).toEqual([0, 0]);
	});

	it("maps shapes and shows task ids", () => {
		expect(scene.elements.some((e) => e.type === "diamond")).toBe(true);
		expect(
			scene.elements.some((e) => e.type === "text" && String(e["text"]).includes("[T001]")),
		).toBe(true);
	});

	it("draws frames as dashed rectangles with a label", () => {
		const frame = scene.elements.find(
			(e) => e.type === "rectangle" && e["strokeStyle"] === "dashed",
		);
		expect(frame).toBeDefined();
		expect(scene.elements.some((e) => e.type === "text" && e["text"] === "group")).toBe(true);
	});

	it("is deterministic with unique ids", () => {
		expect(renderExcalidraw(flowOut)).toBe(renderExcalidraw(flowOut));
		expect(new Set(scene.elements.map((e) => e.id)).size).toBe(scene.elements.length);
		expect(renderExcalidraw(flowOut).endsWith("\n")).toBe(true);
	});

	it("renders sequence diagrams with dashed lifelines and unbound arrows", () => {
		const seq = JSON.parse(
			renderExcalidraw(
				layoutSequence(
					{
						kind: "workflow",
						title: "S",
						layout: "sequence",
						actors: [
							{ id: "x", label: "X" },
							{ id: "y", label: "Y" },
						],
						messages: [{ from: "x", to: "y", label: "go", tasks: ["T002"], style: "dashed" }],
					},
					"004-x",
				),
			),
		) as { elements: El[] };
		const lines = seq.elements.filter((e) => e.type === "line");
		expect(lines).toHaveLength(2);
		const arrow = seq.elements.find((e) => e.type === "arrow") as El;
		expect(arrow["startBinding"]).toBeNull();
		expect(arrow["strokeStyle"]).toBe("dashed");
	});
});
