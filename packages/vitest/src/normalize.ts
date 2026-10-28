import {
	buildReport,
	type ClassifiedResult,
	ConfigError,
	classify,
	manualClock,
	type Policy,
	type Report,
	type ScenarioResult,
} from "@replayguard/core";

/** What a matcher works on. */
export interface Normalized {
	/** Report built from (or equal to) the received value. */
	report: Report;
	/** The classification, unless a report was received. */
	classified: ClassifiedResult | undefined;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);
const isV1 = (v: unknown): v is Record<string, unknown> =>
	isObject(v) && v["version"] === 1 && Array.isArray(v["cases"]);
const isReport = (v: unknown): v is Report =>
	isV1(v) && typeof v["generatedAt"] === "string" && isObject(v["summary"]);
const isClassified = (v: unknown): v is ClassifiedResult =>
	isV1(v) && isObject(v["result"]) && Array.isArray(v["baselineAnomalies"]);
const isScenarioResult = (v: unknown): v is ScenarioResult =>
	isV1(v) && isObject(v["baseline"]) && isObject(v["scenario"]);

function typeName(v: unknown): string {
	if (v === null) return "null";
	return Array.isArray(v) ? "array" : typeof v;
}

/**
 * Turns a scenario result, classified result or report into a report (classifying with
 * `policy` where possible), throwing `ConfigError` for anything else.
 *
 * @example
 * const { report } = normalize(await checkout.run());
 */
export function normalize(received: unknown, policy?: Policy): Normalized {
	if (isClassified(received)) {
		const classified = policy === undefined ? received : classify(received.result, policy);
		return { report: buildReport(classified, { clock: manualClock(0) }), classified };
	}
	if (isReport(received)) {
		if (policy !== undefined) {
			throw new ConfigError(
				"a policy can only be applied to a scenario result or classified result, not to a report",
				"RG_CONFIG_MATCHER",
			);
		}
		return { report: received, classified: undefined };
	}
	if (isScenarioResult(received)) {
		const classified = classify(received, policy);
		return { report: buildReport(classified, { clock: manualClock(0) }), classified };
	}
	throw new ConfigError(
		`expected a scenario result (await scenario.run()), a classified result (classify(...)) or a report (buildReport(...)), got ${typeName(received)}`,
		"RG_CONFIG_MATCHER",
	);
}
