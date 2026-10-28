import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type CliIo, run } from "../src/cli.ts";
import { demoRepo } from "./fixtures.ts";

function io(cwd: string, extra: Partial<CliIo> = {}) {
	const out: string[] = [];
	return { io: { cwd, env: {}, write: (s: string) => out.push(s), ...extra } satisfies CliIo, out };
}

describe("cli", () => {
	it("generates all four exports deterministically and check passes", async () => {
		const root = demoRepo();
		const a = io(root);
		expect(await run(["generate"], a.io)).toBe(0);
		expect(a.out.join("")).toContain("warning: 005-spec-only has no tasks.md");
		const csv = readFileSync(join(root, "exports", "jira.csv"), "utf8");
		expect(csv).toContain("\r\n");
		for (const f of ["jira.json", "github-issues.json", "backlog.csv"]) {
			expect(readFileSync(join(root, "exports", f), "utf8").length).toBeGreaterThan(10);
		}
		expect(await run(["generate"], io(root).io)).toBe(0);
		expect(readFileSync(join(root, "exports", "jira.csv"), "utf8")).toBe(csv);
		const c = io(root);
		expect(await run(["check"], c.io)).toBe(0);
		expect(c.out.join("")).toContain("exports are fresh (36 items)");
	});

	it("check fails when exports are stale", async () => {
		const root = demoRepo();
		await run(["generate"], io(root).io);
		writeFileSync(
			join(root, "specs", "004-demo", "tasks.md"),
			`${readFileSync(join(root, "specs", "004-demo", "tasks.md"), "utf8")}\n- [ ] T031 extra in x.ts\n`,
		);
		const c = io(root);
		expect(await run(["check"], c.io)).toBe(1);
		expect(c.out.join("")).toContain(
			"stale: exports/backlog.csv, exports/github-issues.json, exports/jira.csv, exports/jira.json",
		);
	});

	it("reports malformed tasks with file and line", async () => {
		const root = demoRepo();
		writeFileSync(join(root, "specs", "004-demo", "tasks.md"), "## Phase 1: Setup\n- [ ] no id\n");
		const c = io(root);
		expect(await run(["generate"], c.io)).toBe(1);
		expect(c.out.join("")).toContain(
			'specs/004-demo/tasks.md:2: expected "- [ ] T### [P?] [USn?] description"',
		);
	});

	it("filters by feature", async () => {
		const root = demoRepo();
		await run(["generate", "--feature", "005-spec-only"], io(root).io);
		const json = JSON.parse(readFileSync(join(root, "exports", "jira.json"), "utf8"));
		expect(json.items).toHaveLength(2);
	});

	it("import-jira dry run needs no credentials or network", async () => {
		const root = demoRepo();
		const c = io(root, {
			http: async () => {
				throw new Error("network");
			},
		});
		expect(await run(["import-jira"], c.io)).toBe(0);
		expect(c.out.join("")).toContain(
			"dry run: 35 planned, 0 created, 0 skipped (use --apply to create)",
		);
	});

	it("import-jira --apply validates env and creates via http", async () => {
		const root = demoRepo();
		const missing = io(root);
		expect(await run(["import-jira", "--apply"], missing.io)).toBe(1);
		expect(missing.out.join("")).toContain("missing environment variables");
		let n = 0;
		const c = io(root, {
			env: {
				JIRA_BASE_URL: "https://a.atlassian.net",
				JIRA_EMAIL: "e",
				JIRA_API_TOKEN: "t",
				JIRA_PROJECT_KEY: "RG",
			},
			http: async () => ({ status: 201, text: async () => JSON.stringify({ key: `RG-${++n}` }) }),
		});
		expect(await run(["import-jira", "--apply", "--include-done"], c.io)).toBe(0);
		expect(n).toBe(36);
		expect(c.out.join("")).toContain("applied: 0 planned, 36 created, 0 skipped");
	});

	it("import-github requires --repo when applying and runs gh otherwise", async () => {
		const root = demoRepo();
		const noRepo = io(root);
		expect(await run(["import-github", "--apply"], noRepo.io)).toBe(1);
		expect(noRepo.out.join("")).toContain("--repo owner/name is required with --apply");
		let issue = 0;
		const c = io(root, {
			cmd: async (_cmd, args) => ({
				stdout:
					args[0] === "issue" && args[1] === "create"
						? `https://github.com/o/r/issues/${++issue}`
						: args[0] === "issue"
							? "[]"
							: args[0] === "api" && args[1] !== "-X"
								? "[]"
								: "",
			}),
		});
		expect(await run(["import-github", "--apply", "--repo", "o/r"], c.io)).toBe(0);
		expect(issue).toBe(35);
	});

	it("prints usage", async () => {
		const c = io(demoRepo());
		expect(await run(["nope"], c.io)).toBe(2);
		expect(c.out.join("")).toContain("usage: rg-export");
	});
});
