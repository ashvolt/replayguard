import { describe, expect, it } from "vitest";
import { buildBacklog, type FeatureInput } from "../src/model.ts";

const feature: FeatureInput = {
	feature: "004-effect-ledger",
	spec: {
		title: "Effect Ledger",
		stories: [
			{ number: 1, title: "Instrument", priority: 1, line: 10 },
			{ number: 2, title: "Dedup", priority: 3, line: 20 },
		],
	},
	tasks: [
		{
			id: "T001",
			done: false,
			parallel: false,
			story: null,
			phase: "setup",
			phaseTitle: "Phase 1: Setup",
			description: "Create a in a.ts",
			line: 7,
		},
		{
			id: "T002",
			done: true,
			parallel: true,
			story: 1,
			phase: "us1",
			phaseTitle: "Phase 3: User Story 1",
			description: "Test in a.test.ts",
			line: 9,
		},
		{
			id: "T003",
			done: false,
			parallel: false,
			story: 2,
			phase: "us2",
			phaseTitle: "Phase 4: User Story 2",
			description: "x".repeat(300),
			line: 11,
		},
	],
};

describe("buildBacklog", () => {
	const items = buildBacklog([feature]);

	it("orders epic, stories, then tasks with stable source ids", () => {
		expect(items.map((i) => [i.sourceId, i.type, i.parentSourceId])).toEqual([
			["004-effect-ledger", "Epic", null],
			["004-effect-ledger-US1", "Story", "004-effect-ledger"],
			["004-effect-ledger-US2", "Story", "004-effect-ledger"],
			["004-effect-ledger-T001", "Task", "004-effect-ledger"],
			["004-effect-ledger-T002", "Sub-task", "004-effect-ledger-US1"],
			["004-effect-ledger-T003", "Sub-task", "004-effect-ledger-US2"],
		]);
	});

	it("maps priorities, labels and status", () => {
		const [epic, us1, us2, t1, t2, t3] = items;
		expect([
			epic?.priority,
			us1?.priority,
			us2?.priority,
			t1?.priority,
			t2?.priority,
			t3?.priority,
		]).toEqual(["High", "High", "Low", "Medium", "High", "Low"]);
		expect(t2?.labels).toEqual(["004-effect-ledger", "us1", "parallel"]);
		expect(t1?.labels).toEqual(["004-effect-ledger", "setup"]);
		expect(t2?.status).toBe("Done");
		expect(t1?.status).toBe("To Do");
	});

	it("truncates titles to 255 chars and appends a source reference", () => {
		const t3 = items[5];
		expect(t3?.title.length).toBe(255);
		expect(t3?.title.endsWith("…")).toBe(true);
		expect(t3?.description.endsWith("Source: specs/004-effect-ledger/tasks.md:11")).toBe(true);
		expect(items[1]?.description.endsWith("Source: specs/004-effect-ledger/spec.md:10")).toBe(true);
		expect(items[0]?.title).toBe("004 Effect Ledger");
		expect(items[1]?.title).toBe("US1: Instrument");
		expect(items[3]?.title).toBe("T001 Create a in a.ts");
	});

	it("rejects task story labels missing from the spec", () => {
		const bad: FeatureInput = {
			...feature,
			tasks: [{ ...feature.tasks[0], story: 7, line: 3 } as FeatureInput["tasks"][number]],
		};
		expect(() => buildBacklog([bad])).toThrow(
			"specs/004-effect-ledger/tasks.md:3: task T001 references US7, which is not in spec.md",
		);
	});
});
