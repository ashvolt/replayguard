import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";

const yaml = (feature: string, tasks: string) =>
	[
		`feature: ${feature}`,
		"diagrams:",
		"  - kind: hld",
		"    title: Overview",
		"    layout: flow",
		"    nodes:",
		`      - { id: a, label: A, tasks: [${tasks}] }`,
		"      - { id: b, label: B }",
		"    edges:",
		"      - { from: a, to: b }",
		"",
	].join("\n");

function repo() {
	const root = mkdtempSync(join(tmpdir(), "rg-cli-"));
	writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
	const feature = join(root, "specs", "001-a");
	mkdirSync(feature, { recursive: true });
	writeFileSync(join(feature, "diagram.yaml"), yaml("001-a", "T001, T002"));
	writeFileSync(join(feature, "tasks.md"), "- [ ] T001 a in a.ts\n- [ ] T002 b in b.ts\n");
	return { root, feature };
}

function cli(args: string[], cwd: string) {
	const out: string[] = [];
	const code = run(args, { cwd, write: (s) => out.push(s) });
	return { code, out: out.join("") };
}

describe("cli", () => {
	it("generates excalidraw, svg and traceability outputs deterministically", () => {
		const { root, feature } = repo();
		expect(cli(["generate"], root).code).toBe(0);
		const scene = readFileSync(join(feature, "diagrams", "hld.excalidraw"), "utf8");
		expect(existsSync(join(feature, "diagrams", "hld.svg"))).toBe(true);
		expect(readFileSync(join(feature, "diagrams", "TRACEABILITY.md"), "utf8")).toContain(
			"| T001 |",
		);
		expect(cli(["generate"], root).code).toBe(0);
		expect(readFileSync(join(feature, "diagrams", "hld.excalidraw"), "utf8")).toBe(scene);
	});

	it("check passes after generate and prints a summary", () => {
		const { root } = repo();
		cli(["generate"], root);
		const res = cli(["check"], root);
		expect(res.code).toBe(0);
		expect(res.out).toContain("✓ 001-a: 2/2 tasks traced");
	});

	it("check fails on untraced, unknown and stale", () => {
		const { root, feature } = repo();
		cli(["generate"], root);
		writeFileSync(join(feature, "tasks.md"), "- [ ] T001 a in a.ts\n- [ ] T003 c in c.ts\n");
		writeFileSync(
			join(feature, "diagram.yaml"),
			yaml("001-a", "T001, T002").replace("label: B", "label: B2"),
		);
		const res = cli(["check"], root);
		expect(res.code).toBe(1);
		expect(res.out).toContain(
			"✗ 001-a: untraced T003; unknown T002; stale diagrams/TRACEABILITY.md, diagrams/hld.excalidraw, diagrams/hld.svg",
		);
	});

	it("check fails when a feature with tasks has no diagram source", () => {
		const { root } = repo();
		cli(["generate"], root);
		mkdirSync(join(root, "specs", "002-b"));
		writeFileSync(join(root, "specs", "002-b", "tasks.md"), "- [ ] T001 a in a.ts\n");
		mkdirSync(join(root, "specs", "003-c"));
		const res = cli(["check"], root);
		expect(res.code).toBe(1);
		expect(res.out).toContain("✗ 002-b: missing diagram.yaml");
		expect(res.out).toContain("- 003-c: skipped (no tasks.md yet)");
	});

	it("validation errors exit 1 for generate and check", () => {
		const { root, feature } = repo();
		writeFileSync(join(feature, "diagram.yaml"), yaml("001-a", "T001").replace("to: b", "to: zz"));
		const gen = cli(["generate"], root);
		expect(gen.code).toBe(1);
		expect(gen.out).toContain(
			'specs/001-a/diagram.yaml:diagrams[0].edges[0].to: unknown node "zz"',
		);
		expect(cli(["check"], root).code).toBe(1);
	});

	it("supports --feature filter and coverage command", () => {
		const { root } = repo();
		cli(["generate", "--feature", "001-a"], root);
		const res = cli(["coverage", "--feature", "001-a"], root);
		expect(res.code).toBe(0);
		expect(res.out).toContain("| 001-a | 2 | 2 | hld |");
	});

	it("exempts the architecture source from task checks", () => {
		const { root } = repo();
		mkdirSync(join(root, "docs", "architecture"), { recursive: true });
		writeFileSync(join(root, "docs", "architecture", "diagram.yaml"), yaml("architecture", ""));
		cli(["generate"], root);
		const res = cli(["check"], root);
		expect(res.code).toBe(0);
		expect(res.out).toContain("✓ architecture: diagrams fresh");
	});

	it("prints usage for unknown commands", () => {
		const { root } = repo();
		const res = cli(["bogus"], root);
		expect(res.code).toBe(2);
		expect(res.out).toContain("usage: rg-diagrams <generate|check|coverage> [--feature <id>]");
	});
});
