import { instrument } from "../instrument/instrument.js";
import type { EffectLedger } from "../ledger/ledger.js";
import type { Clock } from "../ports/clock.js";
import type { Sleeper } from "../ports/sleeper.js";
import type { EffectContext } from "./types.js";

/**
 * Creates the effect context handed to an effects factory for one case.
 *
 * @example
 * const ctx = createEffectContext(ledger, systemClock, systemSleeper, 0);
 */
export function createEffectContext(
	ledger: EffectLedger,
	clock: Clock,
	sleeper: Sleeper,
	caseIndex: number,
): EffectContext {
	return {
		ledger,
		clock,
		sleeper,
		caseIndex,
		instrument: (fn, options) => instrument(ledger, fn, options),
	};
}
