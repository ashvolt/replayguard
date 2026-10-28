import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildBacklog } from "../src/model.ts";
import { parseSpec } from "../src/parse/spec.ts";
import { parseTasks } from "../src/parse/tasks.ts";
import { parseCsv } from "../src/render/csv.ts";
import { renderGenericCsv } from "../src/render/generic-csv.ts";
import { renderGithubPlan } from "../src/render/github.ts";
import { renderJiraCsv } from "../src/render/jira-csv.ts";
import { renderJiraJson } from "../src/render/jira-json.ts";

describe("completeness", () => {
	it("every task appears exactly once in every format", () => {
		fc.assert(
			fc.property(
				fc.array(
					fc.record({
						story: fc.integer({ min: 0, max: 3 }),
						parallel: fc.boolean(),
						done: fc.boolean(),
						text: fc.string({ minLength: 1, maxLength: 40 }),
					}),
					{
						minLength: 1,
						maxLength: 30,
					},
				),
				(tasks) => {
					const spec = parseSpec(
						"# Feature Specification: P\n### User Story 1 - A (Priority: P1)\n### User Story 2 - B (Priority: P2)\n### User Story 3 - C (Priority: P3)",
						"s",
					);
					const md = ["## Phase 1: Setup"];
					tasks.forEach((t, i) => {
						const id = `T${String(i + 1).padStart(3, "0")}`;
						const text = t.text.replace(/\s+/g, " ").trim() || "x";
						md.push(
							`- [${t.done ? "x" : " "}] ${id} ${t.parallel ? "[P] " : ""}${t.story ? `[US${t.story}] ` : ""}${text}`,
						);
					});
					const items = buildBacklog([
						{ feature: "001-p", spec, tasks: parseTasks(md.join("\n"), "t") },
					]);
					const taskIds = tasks.map((_, i) => `001-p-T${String(i + 1).padStart(3, "0")}`);
					const jira = JSON.parse(renderJiraJson(items)).items.map(
						(i: { sourceId: string }) => i.sourceId,
					);
					const github = JSON.parse(renderGithubPlan(items)).issues.map(
						(i: { sourceId: string }) => i.sourceId,
					);
					const generic = parseCsv(renderGenericCsv(items))
						.slice(1)
						.map((r) => r[0]);
					const jiraCsv = parseCsv(renderJiraCsv(items))
						.slice(1)
						.map((r) => r[4]?.split("\n").at(-1)?.replace("ReplayGuard-ID: ", ""));
					for (const list of [jira, github, generic, jiraCsv]) {
						for (const id of taskIds) expect(list.filter((x: unknown) => x === id)).toHaveLength(1);
					}
				},
			),
		);
	});
});
