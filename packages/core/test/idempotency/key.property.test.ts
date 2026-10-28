import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type IdempotencyKeyOptions, idempotencyKey } from "../../src/idempotency/key.js";

const text = fc.string({ unit: "grapheme", maxLength: 12 });
const nonEmpty = fc.string({ unit: "grapheme", minLength: 1, maxLength: 12 });
const arbOptions: fc.Arbitrary<IdempotencyKeyOptions> = fc.record(
	{
		iteration: fc.nat(1_000),
		namespace: fc.string({ minLength: 1, maxLength: 8 }),
		parts: fc.array(fc.oneof(text, fc.integer()), { maxLength: 3 }),
	},
	{ requiredKeys: [] },
);
const arbInput = fc.tuple(nonEmpty, nonEmpty, arbOptions);

describe("idempotencyKey properties (FR-001, FR-002)", () => {
	it("is stable across 1,000 simulated restarts", () => {
		fc.assert(
			fc.property(arbInput, ([wf, step, options]) => {
				const first = idempotencyKey({ workflowId: wf }, step, options);
				for (let restart = 0; restart < 1_000; restart++) {
					expect(idempotencyKey({ workflowId: wf }, step, { ...options })).toBe(first);
				}
			}),
			{ numRuns: 20 },
		);
	});

	it("maps different inputs to different keys", () => {
		fc.assert(
			fc.property(arbInput, arbInput, ([wf1, s1, o1], [wf2, s2, o2]) => {
				const same =
					JSON.stringify([wf1, s1, o1.namespace, o1.iteration, o1.parts?.map(String) ?? []]) ===
					JSON.stringify([wf2, s2, o2.namespace, o2.iteration, o2.parts?.map(String) ?? []]);
				const k1 = idempotencyKey({ workflowId: wf1 }, s1, o1);
				const k2 = idempotencyKey({ workflowId: wf2 }, s2, o2);
				expect(k1 === k2).toBe(same);
			}),
		);
	});

	it("never exceeds 255 characters", () => {
		fc.assert(
			fc.property(
				fc.string({ minLength: 1, maxLength: 400 }),
				fc.string({ minLength: 1, maxLength: 400 }),
				(wf, step) => {
					expect(idempotencyKey({ workflowId: wf }, step).length).toBeLessThanOrEqual(255);
				},
			),
		);
	});
});
