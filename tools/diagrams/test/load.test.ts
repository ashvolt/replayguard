import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSources, findRepoRoot, loadSource } from "../src/load.ts";
import { DiagramValidationError } from "../src/schema.ts";

function makeRepo(): string {
	const root = mkdtempSync(join(tmpdir(), "rg-diagrams-"));
	writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
	return root;
}

const yamlFor = (feature: string) =>
	`feature: ${feature}\ndiagrams:\n  - kind: hld\n    title: T\n    layout: flow\n    nodes:\n      - { id: a, label: A, tasks: [T001] }\n`;

describe("load", () => {
	it("finds the repository root from a nested directory", () => {
		const root = makeRepo();
		const nested = join(root, "a", "b");
		mkdirSync(nested, { recursive: true });
		expect(findRepoRoot(nested)).toBe(root);
	});

	it("throws when no repository root exists", () => {
		expect(() => findRepoRoot(mkdtempSync(join(tmpdir(), "rg-none-")))).toThrow(
			/pnpm-workspace\.yaml/,
		);
	});

	it("discovers feature folders and the architecture source", () => {
		const root = makeRepo();
		mkdirSync(join(root, "specs", "001-a"), { recursive: true });
		writeFileSync(join(root, "specs", "001-a", "diagram.yaml"), yamlFor("001-a"));
		writeFileSync(join(root, "specs", "001-a", "tasks.md"), "- [ ] T001 x in a.ts\n");
		mkdirSync(join(root, "specs", "002-b"), { recursive: true });
		writeFileSync(join(root, "specs", "002-b", "tasks.md"), "- [ ] T001 x in a.ts\n");
		mkdirSync(join(root, "specs", "003-c"), { recursive: true });
		writeFileSync(join(root, "specs", "003-c", "spec.md"), "# spec\n");
		writeFileSync(join(root, "specs", "ANALYSIS.md"), "x");
		mkdirSync(join(root, "docs", "architecture"), { recursive: true });
		writeFileSync(join(root, "docs", "architecture", "diagram.yaml"), yamlFor("architecture"));

		const found = discoverSources(root);
		expect(found.map((f) => [f.feature, f.hasSource, f.taskChecked, f.hasTasks])).toEqual([
			["001-a", true, true, true],
			["002-b", false, true, true],
			["003-c", false, true, false],
			["architecture", true, false, false],
		]);
		expect(discoverSources(root, "002-b").map((f) => f.feature)).toEqual(["002-b"]);
	});

	it("loads and validates YAML", () => {
		const root = makeRepo();
		const path = join(root, "diagram.yaml");
		writeFileSync(path, yamlFor("001-a"));
		expect(loadSource(path, "001-a", "x.yaml").diagrams).toHaveLength(1);
	});

	it("reports YAML syntax errors as validation errors", () => {
		const root = makeRepo();
		const path = join(root, "diagram.yaml");
		writeFileSync(path, "feature: [unclosed\n");
		expect(() => loadSource(path, "001-a", "x.yaml")).toThrow(DiagramValidationError);
	});
});
