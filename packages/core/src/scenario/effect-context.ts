import type { InstrumentOptions } from "../instrument/instrument.js";
import type { EffectLedger } from "../ledger/ledger.js";
import type { Clock } from "../ports/clock.js";
import type { Sleeper } from "../ports/sleeper.js";

/** What an effects factory receives for each case. */
export interface EffectContext {
	/** The case's ledger. */
	readonly ledger: EffectLedger;
	/** Time source. */
	readonly clock: Clock;
	/** Waiting port. */
	readonly sleeper: Sleeper;
	/** 0 = baseline, then explicit and explored cases. */
	readonly caseIndex: number;
	/** `instrument()` pre-bound to the case's ledger. */
	instrument<A extends readonly unknown[], R>(
		fn: (...args: A) => R | Promise<R>,
		options: InstrumentOptions<A, R>,
	): (...args: A) => Promise<R>;
}
