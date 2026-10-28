import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

const dir = join(import.meta.dirname, "..", "..", "..", ".github", "workflows");
const workflows = readdirSync(dir)
	.filter((f) => f.endsWith(".yml"))
	.map((file) => ({ file, doc: YAML.parse(readFileSync(join(dir, file), "utf8")) as Workflow }));

interface Step {
	uses?: string;
	with?: Record<string, unknown>;
}
interface Job {
	uses?: string;
	permissions?: Record<string, string> | string;
	steps?: Step[];
}
interface Workflow {
	on: unknown;
	permissions?: Record<string, string> | string;
	jobs: Record<string, Job>;
}

const PINNED = /^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/;

describe("GitHub workflows (FR-010)", () => {
	it("exist", () => {
		expect(workflows.map((w) => w.file).sort()).toEqual([
			"ci.yml",
			"docs.yml",
			"mutation.yml",
			"release.yml",
			"security.yml",
			"version.yml",
		]);
	});

	it.each(workflows)("$file pins every action and reusable workflow to a commit SHA", ({ doc }) => {
		for (const job of Object.values(doc.jobs)) {
			if (job.uses) expect(job.uses).toMatch(PINNED);
			for (const step of job.steps ?? []) if (step.uses) expect(step.uses).toMatch(PINNED);
		}
	});

	it.each(workflows)("$file declares least-privilege top-level permissions", ({ doc }) => {
		expect(doc.permissions).toEqual({ contents: "read" });
		for (const job of Object.values(doc.jobs)) expect(job.permissions).not.toBe("write-all");
	});

	it.each(workflows.filter((w) => w.file !== "version.yml"))(
		"$file checks out without persisting credentials",
		({ doc }) => {
			for (const job of Object.values(doc.jobs)) {
				for (const step of job.steps ?? []) {
					if (step.uses?.startsWith("actions/checkout@")) {
						expect(step.with?.["persist-credentials"]).toBe(false);
					}
				}
			}
		},
	);

	it("only the release job may request an OIDC token", () => {
		for (const { file, doc } of workflows) {
			for (const job of Object.values(doc.jobs)) {
				const perms = typeof job.permissions === "object" ? job.permissions : {};
				if (perms["id-token"] === "write") expect(file).toBe("release.yml");
			}
		}
	});
});
