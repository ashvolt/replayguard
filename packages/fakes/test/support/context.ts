import {
	createEffectContext,
	type EffectContext,
	EffectLedger,
	type ManualSleeper,
	manualClock,
	manualSleeper,
} from "@replayguard/core";

/** A deterministic effect context plus its ledger and sleeper. */
export function testContext(start = 1_000): {
	ctx: EffectContext;
	ledger: EffectLedger;
	sleeper: ManualSleeper;
} {
	const clock = manualClock(start);
	const sleeper = manualSleeper(clock);
	const ledger = new EffectLedger({ clock });
	return { ctx: createEffectContext(ledger, clock, sleeper, 1), ledger, sleeper };
}

/** Attempt statuses in seq order. */
export function statuses(ledger: EffectLedger): string[] {
	return ledger.attempts().map((a) => a.status);
}
