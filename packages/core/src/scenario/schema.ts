import * as v from "valibot";
import { ConfigError } from "../errors.js";

const text = (max: number) =>
	v.pipe(
		v.string(),
		v.minLength(1, `must be 1–${max} chars`),
		v.maxLength(max, `must be 1–${max} chars`),
	);
const int = (min: number, max: number) =>
	v.pipe(
		v.number(),
		v.integer("must be an integer"),
		v.minValue(min, `must be ${min}–${max}`),
		v.maxValue(max, `must be ${min}–${max}`),
	);

/** Valibot schema for the plain-data parts of a scenario definition. */
export const ScenarioOptionsSchema = v.object({
	name: text(120),
	workflowId: text(200),
	seed: v.pipe(v.number(), v.safeInteger("must be a safe integer")),
	budget: v.object({
		maxRuns: int(1, 1000),
		caseTimeoutMs: int(1, 600_000),
		graceMs: int(0, 10_000),
	}),
	explore: v.union([
		v.literal(false),
		v.object({
			strategies: v.pipe(
				v.array(v.picklist(["crash", "throwAfter", "delay", "processKill"])),
				v.minLength(1, "must not be empty"),
			),
			points: v.pipe(v.array(v.picklist(["after", "before"])), v.minLength(1, "must not be empty")),
			maxCases: int(1, 500),
			delayMs: v.optional(int(1, 600_000)),
			kinds: v.optional(v.array(v.string())),
			sample: v.picklist(["first", "random"]),
		}),
	]),
	messages: v.array(
		v.object({ name: text(120), body: v.unknown(), afterRun: v.optional(int(0, 1000)) }),
	),
});

/**
 * Validates scenario options, throwing `ConfigError` naming the offending path.
 *
 * @example
 * validateScenarioOptions({ name: "x", workflowId: "wf", seed: 1, budget, explore: false, messages: [] });
 */
export function validateScenarioOptions(options: unknown): void {
	const result = v.safeParse(ScenarioOptionsSchema, options);
	if (result.success) return;
	const issue = result.issues[0] as v.BaseIssue<unknown>;
	const path = (issue.path ?? []).map((p) => String(p.key)).join(".");
	throw new ConfigError(`invalid scenario ${path}: ${issue.message}`, "RG_CONFIG_SCENARIO");
}
