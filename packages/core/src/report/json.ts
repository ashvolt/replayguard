import * as v from "valibot";
import { SchemaError } from "../errors.js";
import { type Report, ReportSchema } from "./model.js";

/**
 * Serializes a report as stable, indented JSON.
 *
 * @example
 * await writeFile("report.json", reportToJson(report));
 */
export function reportToJson(report: Report): string {
	return `${JSON.stringify(report, null, 2)}\n`;
}

/**
 * Parses and validates report JSON, throwing `SchemaError` (`RG_SCHEMA_JSON`,
 * `RG_SCHEMA_VERSION` or `RG_SCHEMA_REPORT`).
 *
 * @example
 * const report = parseReport(await readFile("report.json", "utf8"));
 */
export function parseReport(json: string): Report {
	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch (error) {
		throw new SchemaError(
			`report is not valid JSON: ${(error as Error).message}`,
			"RG_SCHEMA_JSON",
			{
				cause: error,
			},
		);
	}
	const version = (data as { version?: unknown } | null)?.version;
	if (version !== 1) {
		throw new SchemaError(
			`unsupported report version ${String(version)}; this version of ReplayGuard reads version 1`,
			"RG_SCHEMA_VERSION",
		);
	}
	const result = v.safeParse(ReportSchema, data);
	if (!result.success) {
		const issue = result.issues[0] as v.BaseIssue<unknown>;
		const path = (issue.path ?? []).map((p) => String(p.key)).join(".");
		throw new SchemaError(
			`invalid report${path ? ` at ${path}` : ""}: ${issue.message}`,
			"RG_SCHEMA_REPORT",
		);
	}
	return result.output;
}
