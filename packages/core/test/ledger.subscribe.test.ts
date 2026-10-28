import { describe, expect, it } from "vitest";
import { instrument } from "../src/instrument/instrument.js";
import { EffectLedger } from "../src/ledger/ledger.js";
import type { LedgerEvent } from "../src/ledger/types.js";

describe("observers (US4)", () => {
	it("deliver started then settled synchronously before the call returns", async () => {
		const ledger = new EffectLedger();
		const events: string[] = [];
		ledger.subscribe((e) =>
			events.push(e.type === "attempt-settled" ? `${e.type}:${e.attempt.status}` : e.type),
		);
		ledger.beginRun();
		const fn = instrument(
			ledger,
			async () => {
				events.push("invoked");
				return 1;
			},
			{ kind: "k" },
		);
		await fn();
		events.push("returned");
		ledger.recordFault({ strategy: "crash", anchor: "a" });
		ledger.endRun("completed");
		expect(events).toEqual([
			"run-started",
			"attempt-started",
			"invoked",
			"attempt-settled:applied",
			"returned",
			"fault",
			"run-ended",
		]);
	});

	it("passes immutable copies and supports unsubscribe", async () => {
		const ledger = new EffectLedger();
		const seen: LedgerEvent[] = [];
		const off = ledger.subscribe((e) => seen.push(e));
		const fn = instrument(ledger, async () => 1, { kind: "k" });
		await fn();
		off();
		await fn();
		expect(seen).toHaveLength(2);
		const started = seen[0];
		expect(started?.type === "attempt-started" && started.attempt.status).toBe("started");
		expect(Object.isFrozen(started)).toBe(true);
	});

	it("isolates observer errors and reports them", async () => {
		const ledger = new EffectLedger();
		ledger.subscribe(() => {
			throw new Error("observer broke");
		});
		const fn = instrument(ledger, async () => "ok", { kind: "k" });
		await expect(fn()).resolves.toBe("ok");
		expect(ledger.observerErrors().map((e) => e.message)).toEqual([
			"observer broke",
			"observer broke",
		]);
		ledger.subscribe(() => {
			throw "not an error";
		});
		await fn();
		expect(ledger.observerErrors().at(-1)?.message).toBe("not an error");
	});
});
