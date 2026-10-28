import { describe, expect, it } from "vitest";
import { layoutFlow } from "../src/layout/flow.ts";
import { layoutSequence } from "../src/layout/sequence.ts";
import { escapeXml, renderSvg } from "../src/render/svg.ts";

const out = layoutFlow(
	{
		kind: "lld",
		title: `Escaping <&"'>`,
		layout: "flow",
		direction: "LR",
		groups: [{ id: "g", label: "grp" }],
		nodes: [
			{ id: "a", label: "<script>alert(1)</script>", shape: "box", tasks: ["T001"], group: "g" },
			{ id: "b", label: "B & co", shape: "ellipse", tasks: [] },
			{ id: "c", label: "C", shape: "diamond", tasks: [] },
			{ id: "d", label: "D", shape: "database", tasks: [] },
			{ id: "e", label: "E", shape: "package", tasks: [] },
		],
		edges: [
			{ from: "a", to: "b", style: "dashed", label: "x<y" },
			{ from: "c", to: "c", style: "solid" },
		],
	},
	"004-x",
);

describe("renderSvg", () => {
	const svg = renderSvg(out);

	it("escapes all text", () => {
		expect(escapeXml(`<&"'>`)).toBe("&lt;&amp;&quot;&apos;&gt;");
		expect(svg).not.toContain("<script");
		expect(svg).toContain("&lt;script&gt;");
		expect(svg).toContain("x&lt;y");
	});

	it("contains no external references or event handlers", () => {
		expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
		expect(svg).not.toMatch(/\son[a-z]+=/i);
		expect(svg).not.toContain("xlink:href");
	});

	it("is an accessible standalone svg with title, background and task badges", () => {
		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
		expect(svg).toContain(`<title>Escaping &lt;&amp;&quot;&apos;&gt;</title>`);
		expect(svg).toContain('fill="#ffffff"');
		expect(svg).toContain("[T001]");
		expect(svg).toContain("<ellipse");
		expect(svg).toContain("<polygon");
		expect(svg).toContain('stroke-dasharray="8 6"');
		expect(svg.endsWith("</svg>\n")).toBe(true);
	});

	it("renders sequence diagrams", () => {
		const seq = renderSvg(
			layoutSequence(
				{
					kind: "workflow",
					title: "S",
					layout: "sequence",
					actors: [
						{ id: "x", label: "X" },
						{ id: "y", label: "Y" },
					],
					messages: [{ from: "x", to: "y", label: "go", tasks: [], style: "solid" }],
				},
				"004-x",
			),
		);
		expect(seq).toContain("<polyline");
		expect(seq).toContain(">go<");
	});
});
