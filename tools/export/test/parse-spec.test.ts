import { describe, expect, it } from "vitest";
import { ExportError } from "../src/errors.ts";
import { parseSpec } from "../src/parse/spec.ts";

const spec = [
	"# Feature Specification: Effect Ledger & Instrumentation",
	"",
	"## User Scenarios & Testing *(mandatory)*",
	"",
	"### User Story 1 - Instrument my own function (Priority: P1)",
	"text",
	"### User Story 2 - Record dedup (Priority: P2)",
	"### User Story 3 - Subscribe (Priority: P3)",
].join("\n");

describe("parseSpec", () => {
	it("extracts title and stories with priority and line", () => {
		expect(parseSpec(spec, "specs/004/spec.md")).toEqual({
			title: "Effect Ledger & Instrumentation",
			stories: [
				{ number: 1, title: "Instrument my own function", priority: 1, line: 5 },
				{ number: 2, title: "Record dedup", priority: 2, line: 7 },
				{ number: 3, title: "Subscribe", priority: 3, line: 8 },
			],
		});
	});

	it("fails without a feature title", () => {
		expect(() => parseSpec("no title", "specs/x/spec.md")).toThrow(
			new ExportError('specs/x/spec.md:1: expected "# Feature Specification: <title>"'),
		);
	});

	it("fails on duplicate story numbers", () => {
		const dup = `${spec}\n### User Story 2 - Again (Priority: P2)`;
		expect(() => parseSpec(dup, "s.md")).toThrow(/s\.md:9: duplicate user story 2/);
	});
});
