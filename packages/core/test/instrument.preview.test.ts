import { describe, expect, it } from "vitest";
import { instrument } from "../src/instrument/instrument.js";
import { EffectLedger } from "../src/ledger/ledger.js";

describe("argument privacy (FR-010)", () => {
	it("stores no argument values by default", async () => {
		const ledger = new EffectLedger();
		const send = instrument(ledger, async (_to: string, _body: string) => 1, { kind: "email" });
		await send("alice@example.com", "secret body");
		const json = JSON.stringify(ledger.snapshot());
		expect(json).not.toContain("alice@example.com");
		expect(json).not.toContain("secret body");
		expect(ledger.attempts()[0]?.preview).toBeUndefined();
	});

	it("stores only the redacted preview when opted in", async () => {
		const ledger = new EffectLedger();
		const send = instrument(ledger, async (_to: string, _card: string) => 1, {
			kind: "payment",
			preview: (to, card) => ({ to, card: `****${card.slice(-4)}` }),
		});
		await send("bob", "4242424242424242");
		expect(ledger.attempts()[0]?.preview).toEqual({ to: "bob", card: "****4242" });
		expect(JSON.stringify(ledger.snapshot())).not.toContain("4242424242424242");
	});
});
