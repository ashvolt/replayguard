import { CrashSignal } from "../../errors.js";
import { createTrigger, type FaultStrategy, matchesAnchor } from "../strategy.js";
import { describeFault } from "../types.js";

/**
 * Builds a crash-style strategy: at the anchor, durable storage becomes unavailable
 * (`persistence.crash()` — for process runtimes this kills the process), the run is marked dead
 * and a `CrashSignal` unwinds the workflow. The host then restarts from durable state.
 *
 * @example
 * const processKillStrategy = createCrashStrategy("processKill", true);
 */
export function createCrashStrategy(
	name: "crash" | "processKill",
	requiresProcessIsolation: boolean,
): FaultStrategy {
	return {
		name,
		requiresProcessIsolation,
		arm(spec, env, specIndex) {
			if (spec.strategy !== name) throw new TypeError(`${name} strategy armed with another spec`);
			const trigger = createTrigger(specIndex, name);
			const label = describeFault(spec);
			const fire = (runIndex: number) => {
				trigger.fired(env.ledger.recordFault({ strategy: name, anchor: label }));
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
}

/**
 * In-process crash at an effect (before/after) or durable write.
 *
 * @example
 * new FaultController([crashStrategy]).arm([fault.crashAfter("payment.charge")], env);
 */
export const crashStrategy: FaultStrategy = createCrashStrategy("crash", false);
