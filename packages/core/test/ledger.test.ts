import { describe, expect, it } from "vitest";
import { HarnessError } from "../src/errors.js";
import { EffectLedger } from "../src/ledger/ledger.js";
import { manualClock } from "../src/ports/clock.js";

function ledgerAt(start = 0) {
	const clock = manualClock(start);
	return { clock, ledger: new EffectLedger({ clock }) };
}

describe("EffectLedger runs and attempts", () => {
	it("tracks runs with start, end and reason", () => {
		const { clock, ledger } = ledgerAt(10);
		expect(ledger.currentRun).toBe(0);
		expect(ledger.beginRun()).toBe(0);
		clock.advance(5);
		ledger.endRun("crashed");
		expect(ledger.beginRun()).toBe(1);
		expect(ledger.currentRun).toBe(1);
		expect(ledger.snapshot().runs).toEqual([
			{ runIndex: 0, startedAt: 10, endedAt: 15, endReason: "crashed", dead: false },
			{ runIndex: 1, startedAt: 15, endedAt: undefined, endReason: undefined, dead: false },
		]);
	});

	it("refuses to begin a run while another is active or end a run that is not active", () => {
		const { ledger } = ledgerAt();
		expect(() => ledger.endRun("completed")).toThrow(HarnessError);
		ledger.beginRun();
		expect(() => ledger.beginRun()).toThrow("run 0 is still active");
	});

	it("records attempts with monotonic seq, occurrences and settle transitions", () => {
		const { clock, ledger } = ledgerAt(1);
		ledger.beginRun();
		const p1 = ledger.pendingCall("payment", "o-1", undefined);
		expect(p1).toEqual({
			kind: "payment",
			subject: "o-1",
			identity: "payment::o-1",
			kindOccurrence: 1,
			identityOccurrence: 1,
			idempotencyKey: undefined,
			runIndex: 0,
		});
		const a1 = ledger.beginAttempt(p1, undefined);
		clock.advance(2);
		ledger.settleAttempt(a1.seq, "applied", undefined);
		const a2 = ledger.beginAttempt(ledger.pendingCall("payment", "o-2", "k"), undefined);
		ledger.settleAttempt(a2.seq, "failed", { name: "Error", message: "x" });
		const p3 = ledger.pendingCall("payment", "o-1", undefined);
		expect([p3.kindOccurrence, p3.identityOccurrence]).toEqual([3, 2]);
		const snap = ledger.snapshot();
		expect(snap.version).toBe(1);
		expect(snap.attempts.map((a) => [a.seq, a.status, a.startedAt, a.settledAt])).toEqual([
			[1, "applied", 1, 3],
			[2, "failed", 3, 3],
		]);
		expect(snap.attempts[1]?.error).toEqual({ name: "Error", message: "x" });
		expect(snap.attempts[1]?.idempotencyKey).toBe("k");
	});

	it("rejects settling twice or settling unknown attempts", () => {
		const { ledger } = ledgerAt();
		const a = ledger.beginAttempt(ledger.pendingCall("k", "s", undefined), undefined);
		ledger.settleAttempt(a.seq, "applied", undefined);
		expect(() => ledger.settleAttempt(a.seq, "applied", undefined)).toThrow(
			"attempt 1 already settled",
		);
		expect(() => ledger.settleAttempt(99, "applied", undefined)).toThrow("unknown attempt 99");
	});

	it("returns deep-frozen snapshots that do not change with the ledger", () => {
		const { ledger } = ledgerAt();
		const a = ledger.beginAttempt(ledger.pendingCall("k", "s", undefined), undefined);
		const before = ledger.snapshot();
		ledger.settleAttempt(a.seq, "applied", undefined);
		expect(before.attempts[0]?.status).toBe("started");
		expect(Object.isFrozen(before)).toBe(true);
		expect(Object.isFrozen(before.attempts[0])).toBe(true);
		expect(Object.isFrozen(before.attempts[0]?.inFlightAtFaults)).toBe(true);
		expect(JSON.parse(JSON.stringify(ledger.snapshot())).attempts[0].status).toBe("applied");
	});

	it("exposes attempts() and byIdentity() views", () => {
		const { ledger } = ledgerAt();
		ledger.beginAttempt(ledger.pendingCall("a", "1", undefined), undefined);
		ledger.beginAttempt(ledger.pendingCall("a", "2", undefined), undefined);
		ledger.beginAttempt(ledger.pendingCall("a", "1", undefined), undefined);
		expect(ledger.attempts()).toHaveLength(3);
		expect(ledger.byIdentity("a::1").map((a) => a.seq)).toEqual([1, 3]);
		expect(ledger.byIdentity("nope")).toEqual([]);
	});

	it("exposes overlapping pairs for an identity", () => {
		const { clock, ledger } = ledgerAt();
		const a = ledger.beginAttempt(ledger.pendingCall("p", "1", undefined), undefined);
		clock.advance(1);
		const b = ledger.beginAttempt(ledger.pendingCall("p", "1", undefined), undefined);
		clock.advance(1);
		ledger.settleAttempt(a.seq, "applied", undefined);
		ledger.settleAttempt(b.seq, "applied", undefined);
		expect(ledger.overlapping("p::1").map(([x, y]) => [x.seq, y.seq])).toEqual([[1, 2]]);
	});
});
