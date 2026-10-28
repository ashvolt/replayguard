import { describe, expect, it } from "vitest";
import { type CommandPort, githubTarget } from "../src/import/github.ts";
import { demoItems } from "./fixtures.ts";

function gh(responses: Record<string, string> = {}) {
	const calls: string[][] = [];
	const port: CommandPort = async (cmd, args) => {
		calls.push([cmd, ...args]);
		const key = Object.keys(responses).find((k) => args.join(" ").startsWith(k));
		return { stdout: key ? (responses[key] as string) : "" };
	};
	return { port, calls };
}

describe("github target", () => {
	const items = demoItems();

	it("prepares labels and missing milestones without a shell", async () => {
		const { port, calls } = gh({ "api repos/o/r/milestones?state=all": '[{"title":"Other"}]' });
		const target = githubTarget("o/r", port);
		await target.prepare?.(items);
		expect(calls.every((c) => c[0] === "gh")).toBe(true);
		expect(calls).toContainEqual(["gh", "label", "create", "parallel", "--repo", "o/r", "--force"]);
		expect(calls).toContainEqual(["gh", "label", "create", "sub-task", "--repo", "o/r", "--force"]);
		expect(calls).toContainEqual([
			"gh",
			"api",
			"-X",
			"POST",
			"repos/o/r/milestones",
			"-f",
			"title=004 Demo Feature",
		]);
	});

	it("does not recreate existing milestones", async () => {
		const { port, calls } = gh({
			"api repos/o/r/milestones?state=all": '[{"title":"004 Demo Feature"}]',
		});
		await githubTarget("o/r", port).prepare?.(items);
		expect(calls.some((c) => c.includes("POST"))).toBe(false);
	});

	it("finds existing issues by source marker", async () => {
		const listed = JSON.stringify([
			{ number: 12, body: "x\n<!-- rg-source: 004-demo-US1 -->" },
			{ number: 13, body: "no marker" },
		]);
		const { port } = gh({ "issue list": listed });
		await expect(githubTarget("o/r", port).existing?.()).resolves.toEqual(
			new Map([["004-demo-US1", "#12"]]),
		);
	});

	it("creates issues with parent reference, labels and milestone", async () => {
		const { port, calls } = gh({ "issue create": "https://github.com/o/r/issues/42\n" });
		const target = githubTarget("o/r", port);
		await target.prepare?.(items);
		const sub = items.find((i) => i.sourceId === "004-demo-T005");
		if (!sub) throw new Error("fixture");
		await expect(target.create(sub, "#7")).resolves.toBe("#42");
		const create = calls.find((c) => c[1] === "issue" && c[2] === "create") as string[];
		const arg = (flag: string) => create[create.indexOf(flag) + 1];
		expect(arg("--title")).toBe("T005 Work 0 in s1.ts");
		expect(arg("--label")).toBe("004-demo,us1,parallel,sub-task");
		expect(arg("--milestone")).toBe("004 Demo Feature");
		expect(arg("--body")).toContain("Parent: #7");
		expect(arg("--body")?.endsWith("<!-- rg-source: 004-demo-T005 -->")).toBe(true);
	});

	it("rejects unexpected gh output", async () => {
		const { port } = gh({ "issue create": "oops" });
		await expect(githubTarget("o/r", port).create(items[0] as never, null)).rejects.toThrow(
			"unexpected gh output: oops",
		);
	});
});
