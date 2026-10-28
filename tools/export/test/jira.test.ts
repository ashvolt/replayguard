import { describe, expect, it } from "vitest";
import { TransientError } from "../src/import/importer.ts";
import { type HttpPort, jiraTarget, readJiraEnv, toAdf } from "../src/import/jira.ts";
import { demoItems } from "./fixtures.ts";

const env = {
	JIRA_BASE_URL: "https://acme.atlassian.net/",
	JIRA_EMAIL: "dev@example.com",
	JIRA_API_TOKEN: "s3cr3t-token",
	JIRA_PROJECT_KEY: "RG",
};

function http(status: number, body: string) {
	const calls: { url: string; init: Parameters<HttpPort>[1] }[] = [];
	const port: HttpPort = async (url, init) => {
		calls.push({ url, init });
		return { status, text: async () => body };
	};
	return { port, calls };
}

describe("jira target", () => {
	it("requires all env vars and never echoes values", () => {
		expect(() => readJiraEnv({ JIRA_API_TOKEN: "x" })).toThrow(
			"missing environment variables: JIRA_BASE_URL, JIRA_EMAIL, JIRA_PROJECT_KEY",
		);
		expect(readJiraEnv(env).subtaskType).toBe("Sub-task");
		expect(readJiraEnv({ ...env, JIRA_SUBTASK_TYPE: "Subtask" }).subtaskType).toBe("Subtask");
	});

	it("creates issues with project, parent, ADF description and basic auth", async () => {
		const { port, calls } = http(201, '{"key":"RG-7"}');
		const target = jiraTarget(readJiraEnv(env), port);
		const sub = demoItems().find((i) => i.sourceId === "004-demo-T005");
		if (!sub) throw new Error("fixture");
		await expect(target.create(sub, "RG-2")).resolves.toBe("RG-7");
		const call = calls[0];
		expect(call?.url).toBe("https://acme.atlassian.net/rest/api/3/issue");
		expect(call?.init.method).toBe("POST");
		expect(call?.init.headers["Authorization"]).toBe(
			`Basic ${Buffer.from("dev@example.com:s3cr3t-token").toString("base64")}`,
		);
		const body = JSON.parse(call?.init.body ?? "{}");
		expect(body.fields).toMatchObject({
			project: { key: "RG" },
			issuetype: { name: "Sub-task" },
			parent: { key: "RG-2" },
			priority: { name: "High" },
			labels: ["004-demo", "us1", "parallel"],
		});
		expect(body.fields.description.type).toBe("doc");
	});

	it("omits parent for epics", async () => {
		const { port, calls } = http(201, '{"key":"RG-1"}');
		await jiraTarget(readJiraEnv(env), port).create(demoItems()[0] as never, null);
		expect(JSON.parse(calls[0]?.init.body ?? "{}").fields.parent).toBeUndefined();
	});

	it("classifies 429/5xx as transient and redacts secrets from errors", async () => {
		const items = demoItems();
		await expect(
			jiraTarget(readJiraEnv(env), http(429, "slow down").port).create(items[0] as never, null),
		).rejects.toBeInstanceOf(TransientError);
		const leak = http(400, "bad token s3cr3t-token");
		await expect(
			jiraTarget(readJiraEnv(env), leak.port).create(items[0] as never, null),
		).rejects.toThrow("Jira 400: bad token [redacted]");
	});

	it("converts text to ADF paragraphs, skipping blanks", () => {
		expect(toAdf("a\n\nb")).toEqual({
			type: "doc",
			version: 1,
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "a" }] },
				{ type: "paragraph", content: [{ type: "text", text: "b" }] },
			],
		});
	});
});
