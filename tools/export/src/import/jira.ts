import { ExportError } from "../errors.ts";
import type { BacklogItem } from "../model.ts";
import { type ImportTarget, TransientError } from "./importer.ts";

export interface HttpRequest {
	method: string;
	headers: Record<string, string>;
	body: string;
}

/** Network port (defaults to global fetch) so tests never touch the network. */
export type HttpPort = (
	url: string,
	init: HttpRequest,
) => Promise<{ status: number; text(): Promise<string> }>;

export interface JiraEnv {
	baseUrl: string;
	email: string;
	token: string;
	projectKey: string;
	subtaskType: string;
}

const REQUIRED = ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_PROJECT_KEY"] as const;

/** Reads credentials from environment variables only; errors name variables, never values. */
export function readJiraEnv(env: Readonly<Record<string, string | undefined>>): JiraEnv {
	const missing = REQUIRED.filter((name) => !env[name]);
	if (missing.length > 0)
		throw new ExportError(`missing environment variables: ${missing.join(", ")}`);
	return {
		baseUrl: (env["JIRA_BASE_URL"] as string).replace(/\/+$/, ""),
		email: env["JIRA_EMAIL"] as string,
		token: env["JIRA_API_TOKEN"] as string,
		projectKey: env["JIRA_PROJECT_KEY"] as string,
		subtaskType: env["JIRA_SUBTASK_TYPE"] ?? "Sub-task",
	};
}

/** Plain text → Atlassian Document Format (one paragraph per blank-line-separated block). */
export function toAdf(text: string) {
	return {
		type: "doc",
		version: 1,
		content: text
			.split(/\n{2,}/)
			.map((block) => block.trim())
			.filter((block) => block.length > 0)
			.map((block) => ({ type: "paragraph", content: [{ type: "text", text: block }] })),
	};
}

export const defaultHttp: HttpPort = async (url, init) => {
	const res = await fetch(url, init);
	return { status: res.status, text: () => res.text() };
};

export function jiraTarget(env: JiraEnv, http: HttpPort = defaultHttp): ImportTarget {
	const auth = Buffer.from(`${env.email}:${env.token}`).toString("base64");
	const redact = (text: string) =>
		text.split(env.token).join("[redacted]").split(auth).join("[redacted]");
	return {
		name: "jira",
		async create(item: BacklogItem, parentKey: string | null) {
			const fields: Record<string, unknown> = {
				project: { key: env.projectKey },
				issuetype: { name: item.type === "Sub-task" ? env.subtaskType : item.type },
				summary: item.title,
				description: toAdf(`${item.description}\n\nReplayGuard-ID: ${item.sourceId}`),
				priority: { name: item.priority },
				labels: item.labels,
			};
			if (parentKey !== null) fields["parent"] = { key: parentKey };
			const res = await http(`${env.baseUrl}/rest/api/3/issue`, {
				method: "POST",
				headers: {
					Authorization: `Basic ${auth}`,
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ fields }),
			});
			const text = await res.text();
			if (res.status === 429 || res.status >= 500) throw new TransientError(`Jira ${res.status}`);
			if (res.status !== 201) throw new ExportError(`Jira ${res.status}: ${redact(text)}`);
			return (JSON.parse(text) as { key: string }).key;
		},
	};
}
