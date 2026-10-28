/**
 * Time source port (milliseconds). Injected everywhere time matters so tests are deterministic.
 *
 * @example
 * const ledger = new EffectLedger({ clock: manualClock() });
 */
export interface Clock {
	/** Current time in milliseconds. */
	now(): number;
}

/**
 * Monotonic, sub-millisecond clock aligned to Unix epoch milliseconds.
 *
 * @example
 * const start = systemClock.now();
 */
export const systemClock: Clock = {
	now: () => performance.timeOrigin + performance.now(),
};

/** A clock that only moves when told to. */
export interface ManualClock extends Clock {
	/** Moves time forward by `ms` (must be ≥ 0). */
	advance(ms: number): void;
	/** Sets the current time. */
	set(ms: number): void;
}

/**
 * Deterministic clock for tests.
 *
 * @example
 * const clock = manualClock(0);
 * clock.advance(50); // clock.now() === 50
 */
export function manualClock(start = 0): ManualClock {
	let now = start;
	return {
		now: () => now,
		advance(ms) {
			if (ms < 0) throw new RangeError("cannot advance by a negative duration");
			now += ms;
		},
		set(ms) {
			now = ms;
		},
	};
}
