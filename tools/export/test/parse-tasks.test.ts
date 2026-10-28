import { describe, expect, it } from "vitest";
import { parseTasks } from "../src/parse/tasks.ts";

const md = [
	"# Tasks: X",
	"",
	"## Format: `[ID] [P?] [Story] Description`",
	"",
	"## Phase 1: Setup (Shared Infrastructure)",
	"",
	"- [ ] T001 Create package in tools/x/package.json",
	"- [x] T002 [P] Add config in tools/x/tsconfig.json",
	"",
	"## Phase 2: Foundational (Blocking Prerequisites)",
	"- [X] T003 Write types in src/types.ts",
	"",
	"## Phase 3: User Story 1 - Do it (Priority: P1) 🎯 MVP",
	"",
	"- [ ] T004 [P] [US1] Write failing test in test/a.test.ts",
	"- [ ] T005 [US1] Implement in src/a.ts",
	"",
	"## Phase 4: Polish & Cross-Cutting Concerns",
	"- [ ] T006 Docs in README.md",
	"",
	"## Dependencies & Execution Order",
	"- Setup → Foundational",
].join("\n");

describe("parseTasks", () => {
	it("parses checklist lines with flags, phases and lines", () => {
		const tasks = parseTasks(md, "specs/x/tasks.md");
		expect(tasks.map((t) => [t.id, t.done, t.parallel, t.story, t.phase, t.line])).toEqual([
			["T001", false, false, null, "setup", 7],
			["T002", true, true, null, "setup", 8],
			["T003", true, false, null, "foundational", 11],
			["T004", false, true, 1, "us1", 15],
			["T005", false, false, 1, "us1", 16],
			["T006", false, false, null, "polish", 19],
		]);
		expect(tasks[0]?.description).toBe("Create package in tools/x/package.json");
		expect(tasks[3]?.phaseTitle).toBe("Phase 3: User Story 1 - Do it (Priority: P1) 🎯 MVP");
	});

	it("rejects malformed checklist lines with file:line", () => {
		expect(() => parseTasks("## Phase 1: Setup\n- [ ] Create model", "t.md")).toThrow(
			't.md:2: expected "- [ ] T### [P?] [USn?] description"',
		);
		expect(() => parseTasks("## Phase 1: Setup\n- [ ] T001", "t.md")).toThrow(/t\.md:2/);
	});

	it("rejects tasks before any phase and duplicate ids", () => {
		expect(() => parseTasks("- [ ] T001 x in a.ts", "t.md")).toThrow(
			"t.md:1: task outside a phase",
		);
		expect(() =>
			parseTasks("## Phase 1: Setup\n- [ ] T001 a in a.ts\n- [ ] T001 b in b.ts", "t.md"),
		).toThrow("t.md:3: duplicate task id T001");
	});

	it("slugifies unknown phase names", () => {
		const tasks = parseTasks("## Phase 9: Release Hardening!\n- [ ] T001 a in a.ts", "t.md");
		expect(tasks[0]?.phase).toBe("release-hardening");
	});
});
