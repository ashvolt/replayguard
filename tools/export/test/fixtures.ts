import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBacklog } from "../src/model.ts";
import { parseSpec } from "../src/parse/spec.ts";
import { parseTasks } from "../src/parse/tasks.ts";

export const SPEC = [
	"# Feature Specification: Demo Feature",
	"### User Story 1 - First, with comma (Priority: P1)",
	"### User Story 2 - Second (Priority: P2)",
	"### User Story 3 - Third (Priority: P3)",
].join("\n");

/** 3 stories, 30 tasks: 2 setup, 2 foundational, 8 per story, 2 polish. */
export function tasksMd(): string {
	const lines = [
		"# Tasks",
		"## Phase 1: Setup",
		"- [ ] T001 Init in a.ts",
		'- [x] T002 [P] Quote "x", comma in b.ts',
		"## Phase 2: Foundational",
		"- [ ] T003 Types in c.ts",
		"- [ ] T004 Ports in d.ts",
	];
	let id = 5;
	for (let story = 1; story <= 3; story++) {
		lines.push(`## Phase ${story + 2}: User Story ${story} - S${story} (Priority: P${story})`);
		for (let k = 0; k < 8; k++, id++)
			lines.push(
				`- [ ] T${String(id).padStart(3, "0")} [P] [US${story}] Work ${k} in s${story}.ts`,
			);
	}
	lines.push("## Phase 6: Polish", "- [ ] T029 Docs in README.md", "- [ ] T030 Perf in perf.ts");
	return lines.join("\n");
}

export const demoItems = () =>
	buildBacklog([
		{ feature: "004-demo", spec: parseSpec(SPEC, "s"), tasks: parseTasks(tasksMd(), "t") },
	]);

export function demoRepo(): string {
	const root = mkdtempSync(join(tmpdir(), "rg-export-"));
	writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
	const dir = join(root, "specs", "004-demo");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "spec.md"), SPEC);
	writeFileSync(join(dir, "tasks.md"), tasksMd());
	const spec2 = join(root, "specs", "005-spec-only");
	mkdirSync(spec2);
	writeFileSync(
		join(spec2, "spec.md"),
		"# Feature Specification: Spec Only\n### User Story 1 - A (Priority: P2)\n",
	);
	return root;
}
