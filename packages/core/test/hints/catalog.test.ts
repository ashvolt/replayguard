import { describe, expect, it } from "vitest";
import type { Evidence, Outcome } from "../../src/classifier/types.js";
import { HINT_RULES, INVESTIGATE } from "../../src/hints/catalog.js";
import type { HintContext } from "../../src/hints/types.js";
import type { FaultEvent } from "../../src/ledger/types.js";

const ev = (over: Partial<Evidence> = {}): Evidence => ({
	identity: "payment::o-1",
	kind: "payment",
	subject: "o-1",
	attemptSeqs: [1, 2],
	applied: 2,
	deduplicated: 0,
	failed: 0,
	expected: 1,
	overlaps: [],
	keys: [],
	unsettled: [],
	workflowState: "completed",
	faultIds: ["F1"],
	...over,
});

const fault = (strategy: FaultEvent["strategy"]): FaultEvent => ({
	id: "F1",
	seq: 1,
	runIndex: 0,
	at: 0,
	strategy,
	anchor: "after payment#1",
	inFlight: [],
});

const ctx = (outcome: Outcome, over: Partial<HintContext> = {}): HintContext => ({
	outcome,
	faults: [],
	faultEvents: [fault("crash")],
	finalState: "completed",
	...over,
});

const matching = (e: Evidence, c: HintContext) =>
	HINT_RULES.filter((r) => r.outcomes.includes(c.outcome) && r.matches(e, c)).map((r) => r.id);

describe("hint catalog (US2)", () => {
	it("has unique ids, short titles and code examples", () => {
		const ids = HINT_RULES.map((r) => r.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toEqual([
			"add-idempotency-key",
			"provider-ignores-key",
			"unstable-idempotency-key",
			"timeout-retry-concurrency",
			"orphan-compensate",
			"crash-loop-retries",
			"skipped-ephemeral",
			"allow-by-policy",
		]);
		for (const rule of [...HINT_RULES, INVESTIGATE]) {
			const hint = rule.render(ev(), ctx("duplicated"));
			expect(hint.id).toBe(rule.id);
			expect(hint.title.length).toBeGreaterThan(0);
			expect(hint.title.length).toBeLessThanOrEqual(80);
			expect(hint.explanation.length).toBeGreaterThan(20);
			expect(hint.example.length).toBeGreaterThan(10);
		}
	});

	it("add-idempotency-key: duplicated without any key", () => {
		expect(matching(ev(), ctx("duplicated"))).toEqual(["add-idempotency-key"]);
		const hint = HINT_RULES[0]?.render(ev(), ctx("duplicated"));
		expect(hint?.example).toContain('idempotencyKey(ctx, "payment")');
		expect(hint?.explanation).toContain("payment");
	});

	it("provider-ignores-key: one stable key but no dedup", () => {
		expect(matching(ev({ keys: ["k"] }), ctx("duplicated"))).toEqual(["provider-ignores-key"]);
		expect(matching(ev({ keys: ["k"], deduplicated: 1, applied: 3 }), ctx("duplicated"))).toEqual(
			[],
		);
	});

	it("unstable-idempotency-key: more than one key for one identity", () => {
		const e = ev({ keys: ["k-1", "k-2"] });
		expect(matching(e, ctx("duplicated"))).toEqual(["unstable-idempotency-key"]);
		expect(matching(e, ctx("concurrent-duplicate"))).toContain("unstable-idempotency-key");
		expect(HINT_RULES[2]?.render(e, ctx("duplicated")).explanation).toContain('"k-1", "k-2"');
	});

	it("timeout-retry-concurrency: concurrent duplicate caused by a delay fault", () => {
		const e = ev({ overlaps: [[1, 2]] });
		expect(matching(e, ctx("concurrent-duplicate", { faultEvents: [fault("delay")] }))).toEqual([
			"timeout-retry-concurrency",
		]);
		expect(matching(e, ctx("concurrent-duplicate"))).toEqual([]);
	});

	it("orphan-compensate: applied effect in a failed workflow", () => {
		const e = ev({ applied: 1, workflowState: "failed" });
		expect(matching(e, ctx("orphaned", { finalState: "failed" }))).toEqual(["orphan-compensate"]);
		expect(matching(e, ctx("orphaned", { finalState: "waiting" }))).toEqual([]);
	});

	it("crash-loop-retries: many applies across repeated crashes", () => {
		const loop = ctx("duplicated", { faultEvents: [fault("crash"), fault("processKill")] });
		expect(matching(ev({ applied: 4 }), loop)).toEqual([
			"add-idempotency-key",
			"crash-loop-retries",
		]);
		expect(matching(ev({ applied: 3 }), loop)).toEqual(["add-idempotency-key"]);
		expect(matching(ev({ applied: 4 }), ctx("duplicated"))).toEqual(["add-idempotency-key"]);
	});

	it("skipped-ephemeral: every skipped effect", () => {
		expect(matching(ev({ applied: 0 }), ctx("skipped"))).toEqual(["skipped-ephemeral"]);
	});

	it("allow-by-policy: notification-like kinds", () => {
		for (const kind of [
			"email",
			"email.send",
			"webhook.deliver",
			"sms",
			"push:ios",
			"notification",
		]) {
			expect(matching(ev({ kind }), ctx("duplicated"))).toContain("allow-by-policy");
		}
		expect(matching(ev({ kind: "emailer" }), ctx("duplicated"))).not.toContain("allow-by-policy");
		const hint = HINT_RULES[7]?.render(ev({ kind: "email.send" }), ctx("duplicated"));
		expect(hint?.example).toContain('"email.send": { duplicated: "warn" }');
	});

	it("investigate is the generic fallback", () => {
		expect(INVESTIGATE.render(ev(), ctx("duplicated")).id).toBe("investigate");
		expect(INVESTIGATE.matches(ev(), ctx("duplicated"))).toBe(true);
	});
});
