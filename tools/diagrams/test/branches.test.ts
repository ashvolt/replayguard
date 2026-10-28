import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { layoutDiagram } from "../src/layout/index.ts";
import type { LaidOutDiagram } from "../src/layout/types.ts";
import { discoverSources } from "../src/load.ts";
import { renderExcalidraw } from "../src/render/excalidraw.ts";
import { renderSvg } from "../src/render/svg.ts";
import { findStale } from "../src/stale.ts";
import { wrap } from "../src/text.ts";

const manual: LaidOutDiagram = {
	feature: "f",
	kind: "lld",
	title: { lines: ["t"], fontSize: 24, x: 40, y: 30, width: 15, height: 30 },
	width: 400,
	height: 300,
	frames: [],
	boxes: [
		{
			key: "node:p",
			x: 40,
			y: 90,
			width: 140,
			height: 60,
			shape: "package",
			label: "P",
			tasks: [],
			text: { lines: ["P"], fontSize: 16, x: 100, y: 110, width: 10, height: 20 },
		},
	],
	arrows: [],
	lines: [
		{
			key: "line:solid",
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
			],
			dashed: false,
		},
	],
};

describe("branch coverage", () => {
	it("dispatches layouts by strategy", () => {
		const seq = layoutDiagram(
			{
				kind: "workflow",
				title: "S",
				layout: "sequence",
				actors: [
					{ id: "a", label: "A" },
					{ id: "b", label: "B" },
				],
				messages: [{ from: "a", to: "b", label: "m", tasks: [], style: "solid" }],
			},
			"f",
		);
		expect(seq.lines).toHaveLength(2);
		const flow = layoutDiagram(
			{
				kind: "hld",
				title: "F",
				layout: "flow",
				direction: "TB",
				groups: [],
				nodes: [{ id: "a", label: "A", shape: "box", tasks: [] }],
				edges: [],
			},
			"f",
		);
		expect(flow.lines).toHaveLength(0);
	});

	it("flushes the current line before hard-splitting a long word", () => {
		expect(wrap(`ab ${"x".repeat(12)}`, 10, 60)).toEqual(["ab", "xxxxxxxxxx", "xx"]);
	});

	it("renders solid lines and package shapes", () => {
		expect(renderSvg(manual)).toContain(
			'<polyline points="0,0 10,10" fill="none" stroke="#868e96" stroke-width="1"/>',
		);
		const scene = JSON.parse(renderExcalidraw(manual)) as { elements: Record<string, unknown>[] };
		const line = scene.elements.find((e) => e["type"] === "line");
		expect(line?.["strokeStyle"]).toBe("solid");
		const pkg = scene.elements.find((e) => e["type"] === "rectangle");
		expect(pkg?.["roundness"]).toBeNull();
	});

	it("finds stale root-level outputs", () => {
		const dir = mkdtempSync(join(tmpdir(), "rg-root-"));
		writeFileSync(join(dir, "x.md"), "old\n");
		expect(findStale(dir, new Map([["x.md", "new\n"]]))).toEqual(["x.md"]);
	});

	it("ignores feature-named files in specs and lists architecture coverage", () => {
		const root = mkdtempSync(join(tmpdir(), "rg-cov-"));
		writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
		mkdirSync(join(root, "specs"));
		writeFileSync(join(root, "specs", "001-file"), "not a dir");
		mkdirSync(join(root, "docs", "architecture"), { recursive: true });
		writeFileSync(
			join(root, "docs", "architecture", "diagram.yaml"),
			"feature: architecture\ndiagrams:\n  - { kind: hld, title: A, layout: flow, nodes: [{ id: a, label: A }] }\n",
		);
		expect(discoverSources(root).map((f) => f.feature)).toEqual(["architecture"]);
		const out: string[] = [];
		expect(run(["coverage"], { cwd: root, write: (s) => out.push(s) })).toBe(0);
		expect(out.join("")).toContain("| architecture | — | — | hld |");
	});
});
