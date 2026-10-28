import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/render/csv.ts";
import { renderGenericCsv } from "../src/render/generic-csv.ts";
import { renderGithubPlan } from "../src/render/github.ts";
import { renderJiraCsv } from "../src/render/jira-csv.ts";
import { renderJiraJson } from "../src/render/jira-json.ts";
import { demoItems } from "./fixtures.ts";

const items = demoItems();

describe("jira csv", () => {
	const rows = parseCsv(renderJiraCsv(items));
	const header = rows[0] as string[];
	const body = rows.slice(1);
	const col = (name: string) => header.indexOf(name);

	it("has the importer header with one Labels column per label", () => {
		expect(header.slice(0, 7)).toEqual([
			"Issue Id",
			"Parent Id",
			"Issue Type",
			"Summary",
			"Description",
			"Priority",
			"Status",
		]);
		expect(header.filter((h) => h === "Labels")).toHaveLength(3);
	});

	it("contains 1 epic, 3 stories, 24 sub-tasks and 6 tasks with numeric parent links", () => {
		const count = (t: string) => body.filter((r) => r[col("Issue Type")] === t).length;
		expect([count("Epic"), count("Story"), count("Sub-task"), count("Task")]).toEqual([
			1, 3, 24, 6,
		]);
		const ids = new Map(body.map((r) => [r[0], r]));
		for (const r of body) {
			expect(r[0]).toMatch(/^\d+$/);
			if (r[col("Issue Type")] === "Epic") expect(r[1]).toBe("");
			else expect(ids.has(r[1] as string)).toBe(true);
		}
		const sub = body.find((r) => r[col("Summary")]?.startsWith("T005")) as string[];
		expect(ids.get(sub[1] as string)?.[col("Issue Type")]).toBe("Story");
	});

	it("preserves quotes and commas and ends descriptions with the source id", () => {
		const t2 = body.find((r) => r[col("Summary")]?.startsWith("T002")) as string[];
		expect(t2[col("Summary")]).toBe('T002 Quote "x", comma in b.ts');
		expect(t2[col("Status")]).toBe("Done");
		expect(t2[col("Description")]?.split("\n").at(-1)).toBe("ReplayGuard-ID: 004-demo-T002");
		expect(t2.slice(7)).toEqual(["004-demo", "setup", "parallel"]);
	});
});

describe("jira json", () => {
	it("mirrors items with REST field shapes", () => {
		const json = JSON.parse(renderJiraJson(items)) as {
			version: number;
			items: Record<string, unknown>[];
		};
		expect(json.version).toBe(1);
		expect(json.items).toHaveLength(items.length);
		expect(json.items[4]).toMatchObject({
			sourceId: "004-demo-T001",
			parentSourceId: "004-demo",
			status: "To Do",
			fields: {
				issuetype: { name: "Task" },
				priority: { name: "Medium" },
				labels: ["004-demo", "setup"],
			},
		});
	});
});

describe("github plan", () => {
	it("has one milestone per feature and marked issue bodies", () => {
		const plan = JSON.parse(renderGithubPlan(items)) as {
			milestones: { feature: string; title: string }[];
			issues: { sourceId: string; body: string; labels: string[]; milestone: string }[];
		};
		expect(plan.milestones).toEqual([{ feature: "004-demo", title: "004 Demo Feature" }]);
		const issue = plan.issues.find((i) => i.sourceId === "004-demo-T005");
		expect(issue?.body.endsWith("<!-- rg-source: 004-demo-T005 -->")).toBe(true);
		expect(issue?.labels).toEqual(["004-demo", "us1", "parallel", "sub-task"]);
		expect(issue?.milestone).toBe("004 Demo Feature");
	});
});

describe("generic csv", () => {
	it("has parent ids that exist in the file", () => {
		const rows = parseCsv(renderGenericCsv(items));
		expect(rows[0]).toEqual([
			"id",
			"parent_id",
			"type",
			"title",
			"description",
			"labels",
			"priority",
			"status",
			"feature",
		]);
		const ids = new Set(rows.slice(1).map((r) => r[0]));
		for (const r of rows.slice(1)) {
			expect(r[0]).not.toBe("");
			if (r[2] !== "Epic") expect(ids.has(r[1])).toBe(true);
		}
		expect(rows.find((r) => r[0] === "004-demo-T002")?.[5]).toBe("004-demo;setup;parallel");
	});
});
