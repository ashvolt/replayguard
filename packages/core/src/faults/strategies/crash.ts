import { CrashSignal } from "../../errors.js";
import { createTrigger, type FaultStrategy, matchesAnchor } from "../strategy.js";
import { describeFault } from "../types.js";

/**
 * In-process crash: at the anchor, durable storage stops accepting writes, the run is marked dead
 * and a `CrashSignal` unwinds the workflow. The host then restarts from durable state.
 *
 * @example
 * new FaultController([crashStrategy]).arm([fault.crashAfter("payment.charge")], env);
 */
export const crashStrategy: FaultStrategy = {
	name: "crash",
	requiresProcessIsolation: false,
	arm(spec, env, specIndex) {
		if (spec.strategy !== "crash") throw new TypeError("crashStrategy armed with a non-crash spec");
		const trigger = createTrigger(specIndex, "crash");
		const label = describeFault(spec);
		const fire = (runIndex: number) => {
			trigger.fired(env.ledger.recordFault({ strategy: "crash", anchor: label }));
			env.persistence.crash();
			env.ledger.markRunDead(runIndex);
			return new CrashSignal(`simulated crash: ${label}`);
		};
		const { anchor } = spec;
		let dispose: () => void;
		if (anchor.type === "write") {
			dispose = env.persistence.onBeforeWrite((index) => {
				if (!trigger.triggered && index === anchor.index) throw fire(env.ledger.currentRun);
			});
		} else if (spec.point === "before") {
			dispose = env.ledger.addHooks({
				beforeStart(call) {
					if (!trigger.triggered && matchesAnchor(anchor, call)) throw fire(call.runIndex);
				},
			});
		} else {
			dispose = env.ledger.addHooks({
				afterSettle(attempt) {
					if (
						!trigger.triggered &&
						attempt.status !== "failed" &&
						attempt.runIndex === env.ledger.currentRun &&
						matchesAnchor(anchor, attempt)
					) {
						throw fire(attempt.runIndex);
					}
				},
			});
		}
		return { outcome: trigger.outcome, dispose };
	},
};
