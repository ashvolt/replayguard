import { describe, expect, it } from "vitest";
import { classify } from "../../src/classifier/classify.js";
import { caseResult, scenarioResult } from "../classifier/arbitraries.js";

describe("unstable idempotency keys (US3)", () => {
	it("flags a key built from Date.now() that changes across restarts", () => {
		const result = scenarioResult(caseResult(0, [{ key: "o-1:1700000000000" }]), [
			caseResult(
				1,
				[
					{ key: "o-1:1700000000000", run: 0 },
					{ key: "o-1:1700000000913", run: 1 },
				],
				{ faults: [{ strategy: "crash", anchor: "after payment#1" }], restarts: 1 },
			),
		]);
		const [effect] = classify(result).cases[1]?.effects ?? [];
		expect(effect?.outcome).toBe("duplicated");
		expect(effect?.evidence.keys).toEqual(["o-1:1700000000000", "o-1:1700000000913"]);
		expect(effect?.hints.map((h) => h.id)).toEqual(["unstable-idempotency-key"]);
		expect(effect?.hints[0]?.title).toBe("Make the idempotency key stable across retries");
	});

	it("does not flag a stable key that the provider deduplicated", () => {
		const result = scenarioResult(caseResult(0, [{ key: "k" }]), [
			caseResult(1, [{ key: "k" }, { key: "k", status: "deduplicated" }]),
		]);
		const [effect] = classify(result).cases[1]?.effects ?? [];
		expect(effect?.outcome).toBe("deduplicated");
		expect(effect?.hints).toEqual([]);
	});
});
