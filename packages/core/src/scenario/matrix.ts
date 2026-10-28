import { type FaultPoint, type FaultSpec, fault } from "../faults/types.js";
import type { Occurrence } from "./discovery.js";
import type { SkippedCase } from "./result.js";
import { mulberry32 } from "./seed.js";
import type { CaseDefinition, ExploreOptions, ExploreStrategy } from "./types.js";

/** Inputs for fault matrix generation. */
export interface MatrixInput {
	/** Baseline effect occurrences. */
	occurrences: readonly Occurrence[];
	/** Exploration options. */
	explore: ExploreOptions;
	/** Explicit cases' fault lists (not regenerated). */
	explicit: readonly (readonly FaultSpec[])[];
	/** Whether the runtime supports process kill. */
	processIsolated: boolean;
	/** Seed for random sampling. */
	seed: number;
}

/** Generated cases and the candidates left out by the budget. */
export interface MatrixResult {
	/** Cases to run, in priority order. */
	cases: CaseDefinition[];
	/** Candidates over budget. */
	skipped: SkippedCase[];
}

function specFor(
	strategy: ExploreStrategy,
	point: FaultPoint,
	o: Occurrence,
	delayMs: number,
): FaultSpec {
	const anchor = { type: "effect" as const, kind: o.kind, occurrence: o.occurrence };
	switch (strategy) {
		case "crash":
			return point === "after"
				? fault.crashAfter(o.kind, o.occurrence)
				: fault.crashBefore(o.kind, o.occurrence);
		case "throwAfter":
			return point === "after"
				? fault.loseResponse(o.kind, o.occurrence)
				: fault.loseRequest(o.kind, o.occurrence);
		case "delay":
			return fault.delay(o.kind, delayMs, o.occurrence);
		case "processKill":
			return { strategy: "processKill", anchor, point };
	}
}

/**
 * Generates explored cases: occurrence × point × strategy, after-points first, then strategy
 * order, then occurrence order; minus explicit cases; truncated (or seeded-sampled) to budget.
 *
 * @example
 * buildMatrix({ occurrences, explore: DEFAULT_EXPLORE, explicit: [], processIsolated: false, seed: 1 });
 */
export function buildMatrix(input: MatrixInput): MatrixResult {
	const { explore } = input;
	const points: FaultPoint[] = (["after", "before"] as const).filter((p) =>
		explore.points.includes(p),
	);
	const explicit = new Set(input.explicit.map((faults) => JSON.stringify(faults)));
	const candidates: CaseDefinition[] = [];
	points.forEach((point, pointIndex) => {
		for (const strategy of explore.strategies) {
			if (strategy === "processKill" && !input.processIsolated) continue;
			if (strategy === "delay" && (explore.delayMs === undefined || pointIndex > 0)) continue;
			for (const o of input.occurrences) {
				const faults = [specFor(strategy, point, o, explore.delayMs ?? 0)];
				if (explicit.has(JSON.stringify(faults))) continue;
				const where = strategy === "delay" ? "inflight" : point;
				candidates.push({ name: `${strategy}@${where}:${o.kind}#${o.occurrence}`, faults });
			}
		}
	});
	let chosen = new Set(candidates.slice(0, explore.maxCases).map((_, i) => i));
	if (explore.sample === "random" && candidates.length > explore.maxCases) {
		const next = mulberry32(input.seed);
		const order = candidates.map((_, i) => i);
		for (let i = order.length - 1; i > 0; i--) {
			const j = Math.floor(next() * (i + 1));
			[order[i], order[j]] = [order[j] as number, order[i] as number];
		}
		chosen = new Set(order.slice(0, explore.maxCases));
	}
	return {
		cases: candidates.filter((_, i) => chosen.has(i)),
		skipped: candidates.filter((_, i) => !chosen.has(i)),
	};
}
