import { type ManualClock, manualClock } from "./clock.js";

/**
 * Waiting port (retry backoff, provider hangs). Injected so tests can control time.
 *
 * @example
 * await sleeper.sleep(retryAt - clock.now());
 */
export interface Sleeper {
	/** Resolves after `ms` milliseconds (negative values resolve immediately). */
	sleep(ms: number): Promise<void>;
}

/**
 * Real timers.
 *
 * @example
 * await systemSleeper.sleep(10);
 */
export const systemSleeper: Sleeper = {
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms))),
};

/** A sleeper driven by a manual clock. */
export interface ManualSleeper extends Sleeper {
	/** The clock this sleeper advances. */
	readonly clock: ManualClock;
	/** Number of sleeps still waiting. */
	readonly pending: number;
	/** Advances the clock by `ms` and resolves every sleep that is now due, earliest first. */
	advance(ms: number): Promise<void>;
}

/**
 * Deterministic sleeper for tests: sleeps resolve only when `advance()` moves time past them.
 *
 * @example
 * const sleeper = manualSleeper();
 * const done = sleeper.sleep(100);
 * await sleeper.advance(100); // `done` is now resolved
 */
export function manualSleeper(clock: ManualClock = manualClock()): ManualSleeper {
	const waiting: { at: number; order: number; resolve: () => void }[] = [];
	let order = 0;
	return {
		clock,
		get pending() {
			return waiting.length;
		},
		sleep(ms) {
			return new Promise((resolve) => {
				waiting.push({ at: clock.now() + Math.max(0, ms), order: order++, resolve });
			});
		},
		async advance(ms) {
			clock.advance(ms);
			const due = waiting
				.filter((w) => w.at <= clock.now())
				.sort((a, b) => a.at - b.at || a.order - b.order);
			for (const w of due) {
				waiting.splice(waiting.indexOf(w), 1);
				w.resolve();
				await Promise.resolve();
			}
			await new Promise((resolve) => setTimeout(resolve, 0));
		},
	};
}
