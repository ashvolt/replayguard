import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { run } from "../src/cli.ts";

function bigRepo(features: number): string {
	const root = mkdtempSync(join(tmpdir(), "rg-perf-"));
	writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
	for (let f = 1; f <= features; f++) {
		const name = `${String(f).padStart(3, "0")}-feature`;
		const dir = join(root, "specs", name);
		mkdirSync(dir, { recursive: true });
		const nodes = Array.from(
			{ length: 40 },
			(_, i) =>
				`      - { id: n${i}, label: Node number ${i}, tasks: [T${String(i + 1).padStart(3, "0")}] }`,
		);
		const edges = Array.from(
			{ length: 60 },
			(_, i) => `      - { from: n${i % 40}, to: n${(i * 7 + 3) % 40} }`,
		);
		const diagrams = ["hld", "lld", "architecture"].map((kind) =>
			[
				`  - kind: ${kind}`,
				"    title: Perf",
				"    layout: flow",
				"    nodes:",
				...nodes,
				"    edges:",
				...edges,
			].join("\n"),
		);
		writeFileSync(
			join(dir, "diagram.yaml"),
			[`feature: ${name}`, "diagrams:", ...diagrams, ""].join("\n"),
		);
		writeFileSync(
			join(dir, "tasks.md"),
			Array.from(
				{ length: 40 },
				(_, i) => `- [ ] T${String(i + 1).padStart(3, "0")} task in a.ts`,
			).join("\n"),
		);
	}
	return root;
}

describe("performance and isolation", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("generates and checks 14 large sources in under 10 s without network access", () => {
		vi.stubGlobal("fetch", () => {
			throw new Error("network access is forbidden");
		});
		const root = bigRepo(14);
		const silent = { cwd: root, write: () => undefined };
		const start = performance.now();
		expect(run(["generate"], silent)).toBe(0);
		expect(run(["check"], silent)).toBe(0);
		expect(performance.now() - start).toBeLessThan(10_000);
	});
});
