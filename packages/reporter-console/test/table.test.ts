import { describe, expect, it } from "vitest";
import { renderTable, truncate } from "../src/table.js";

describe("renderTable (T010)", () => {
	it("sizes columns from content with box-drawing separators", () => {
		expect(
			renderTable(
				["Case", "Verdict"],
				[
					["crash", "FAIL"],
					["lost response", "PASS"],
				],
			),
		).toBe(
			[
				"Case          │ Verdict",
				"──────────────┼────────",
				"crash         │ FAIL",
				"lost response │ PASS",
			].join("\n"),
		);
	});

	it("falls back to ASCII", () => {
		expect(renderTable(["A", "B"], [["x", "y"]], { ascii: true })).toBe(
			["A | B", "--+--", "x | y"].join("\n"),
		);
	});

	it("caps columns at 40 characters and truncates with an ellipsis", () => {
		const long = "x".repeat(50);
		const [header, , row] = renderTable(["Explanation", "V"], [[long, "FAIL"]]).split("\n");
		expect(row).toBe(`${"x".repeat(39)}… │ FAIL`);
		expect(header).toBe(`Explanation${" ".repeat(29)} │ V`);
		const narrow = renderTable(["E"], [[long]], { maxWidth: 10 }).split("\n")[2];
		expect(narrow).toBe(`${"x".repeat(9)}…`);
	});

	it("flattens newlines and applies style after padding", () => {
		const out = renderTable(["A", "B"], [["one\ntwo", "z"]], {
			style: (text, row, col) => (row === 0 && col === 0 ? `<${text}>` : text),
		});
		expect(out.split("\n")[2]).toBe("<one two> │ z");
		expect(out.split("\n")[0]).toBe("A       │ B");
	});

	it("renders headers only for no rows", () => {
		expect(renderTable(["A"], [])).toBe("A\n─");
	});
});

describe("truncate", () => {
	it("keeps short text and cuts long text to the width", () => {
		expect(truncate("abc", 3)).toBe("abc");
		expect(truncate("abcd", 3)).toBe("ab…");
		expect(truncate("abcd", 1)).toBe("…");
	});
});
