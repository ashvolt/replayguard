import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fault } from "../../src/faults/types.js";
import { buildMatrix } from "../../src/scenario/matrix.js";
import { DEFAULT_EXPLORE } from "../../src/scenario/types.js";

const occ = [
	{ kind: "email", occurrence: 1 },
	{ kind: "payment", occurrence: 1 },
];

describe("buildMatrix (US2)", () => {
	it("generates occurrences × points × strategies in priority order", () => {
		const { cases, skipped } = buildMatrix({
			occurrences: occ,
			explore: DEFAULT_EXPLORE,
			explicit: [],
			processIsolated: false,
			seed: 1,
		});
		expect(cases.map((c) => c.name)).toEqual([
			"crash@after:email#1",
			"crash@after:payment#1",
			"throwAfter@after:email#1",
			"throwAfter@after:payment#1",
			"crash@before:email#1",
			"crash@before:payment#1",
			"throwAfter@before:email#1",
			"throwAfter@before:payment#1",
		]);
		expect(cases[0]?.faults).toEqual([fault.crashAfter("email")]);
		expect(cases[4]?.faults).toEqual([fault.crashBefore("email")]);
		expect(skipped).toEqual([]);
	});

	it("maps throwAfter@before to a lost request", () => {
		const { cases } = buildMatrix({
			occurrences: occ.slice(0, 1),
			explore: DEFAULT_EXPLORE,
			explicit: [],
			processIsolated: false,
			seed: 1,
		});
		expect(cases.find((c) => c.name === "throwAfter@before:email#1")?.faults).toEqual([
			fault.loseRequest("email"),
		]);
		expect(cases.find((c) => c.name === "throwAfter@after:email#1")?.faults).toEqual([
			fault.loseResponse("email"),
		]);
	});

	it("truncates to the budget and reports skipped candidates", () => {
		const { cases, skipped } = buildMatrix({
			occurrences: occ,
			explore: { ...DEFAULT_EXPLORE, maxCases: 5 },
			explicit: [],
			processIsolated: false,
			seed: 1,
		});
		expect(cases).toHaveLength(5);
		expect(skipped.map((s) => s.name)).toEqual([
			"crash@before:payment#1",
			"throwAfter@before:email#1",
			"throwAfter@before:payment#1",
		]);
	});

	it("does not regenerate explicit cases", () => {
		const { cases } = buildMatrix({
			occurrences: occ,
			explore: DEFAULT_EXPLORE,
			explicit: [[fault.crashAfter("payment")]],
			processIsolated: false,
			seed: 1,
		});
		expect(cases.map((c) => c.name)).not.toContain("crash@after:payment#1");
		expect(cases).toHaveLength(7);
	});

	it("adds delay only with delayMs and processKill only on process runtimes", () => {
		const explore = {
			...DEFAULT_EXPLORE,
			strategies: ["delay", "processKill"] as const,
			points: ["after"] as const,
			delayMs: 250,
		};
		expect(
			buildMatrix({
				occurrences: occ,
				explore: { ...explore, strategies: [...explore.strategies], points: [...explore.points] },
				explicit: [],
				processIsolated: false,
				seed: 1,
			}).cases.map((c) => c.name),
		).toEqual(["delay@inflight:email#1", "delay@inflight:payment#1"]);
		const isolated = buildMatrix({
			occurrences: occ,
			explore: { ...explore, strategies: [...explore.strategies], points: [...explore.points] },
			explicit: [],
			processIsolated: true,
			seed: 1,
		});
		expect(isolated.cases.map((c) => c.name)).toContain("processKill@after:payment#1");
		expect(isolated.cases[0]?.faults).toEqual([fault.delay("email", 250)]);
		const noDelay = buildMatrix({
			occurrences: occ,
			explore: { ...DEFAULT_EXPLORE, strategies: ["delay"], points: ["after"] },
			explicit: [],
			processIsolated: false,
			seed: 1,
		});
		expect(noDelay.cases).toEqual([]);
	});

	it("random sampling is seeded, keeps priority order and respects the budget", () => {
		const params = (seed: number) => ({
			occurrences: Array.from({ length: 6 }, (_, i) => ({ kind: `k${i}`, occurrence: 1 })),
			explore: { ...DEFAULT_EXPLORE, maxCases: 4, sample: "random" as const },
			explicit: [],
			processIsolated: false,
			seed,
		});
		const a = buildMatrix(params(7));
		expect(buildMatrix(params(7))).toEqual(a);
		expect(a.cases).toHaveLength(4);
		const all = buildMatrix({
			...params(7),
			explore: { ...params(7).explore, maxCases: 500 },
		}).cases.map((c) => c.name);
		const positions = a.cases.map((c) => all.indexOf(c.name));
		expect([...positions].sort((x, y) => x - y)).toEqual(positions);
		expect(buildMatrix(params(8)).cases.map((c) => c.name)).not.toEqual(a.cases.map((c) => c.name));
	});

	it("count = occurrences × points × strategies (property)", () => {
		fc.assert(
			fc.property(
				fc.uniqueArray(fc.stringMatching(/^[a-z]{1,4}$/), { minLength: 1, maxLength: 5 }),
				fc.subarray(["after", "before"] as const, { minLength: 1 }),
				fc.subarray(["crash", "throwAfter"] as const, { minLength: 1 }),
				(kinds, points, strategies) => {
					const occurrences = kinds.map((kind) => ({ kind, occurrence: 1 }));
					const { cases, skipped } = buildMatrix({
						occurrences,
						explore: {
							...DEFAULT_EXPLORE,
							points: [...points],
							strategies: [...strategies],
							maxCases: 500,
						},
						explicit: [],
						processIsolated: false,
						seed: 1,
					});
					expect(cases.length + skipped.length).toBe(
						kinds.length * points.length * strategies.length,
					);
					expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length);
				},
			),
		);
	});
});
