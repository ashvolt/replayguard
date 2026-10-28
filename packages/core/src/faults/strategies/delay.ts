import { createTrigger, type FaultStrategy, matchesAnchor } from "../strategy.js";
import { describeFault } from "../types.js";

/**
 * Provider hang: holds the anchored attempt in flight for `delayMs` before the provider runs,
 * without cancelling it — so a step timeout can fire while the effect still completes later.
 *
 * @example
 * new FaultController([delayStrategy]).arm([fault.delay("payment.charge", 500)], env);
 */
export const delayStrategy: FaultStrategy = {
	name: "delay",
	requiresProcessIsolation: false,
	arm(spec, env, specIndex) {
		if (spec.strategy !== "delay") throw new TypeError("delayStrategy armed with another spec");
		const trigger = createTrigger(specIndex, "delay");
		const label = describeFault(spec);
		const dispose = env.ledger.addHooks({
			async inFlight(attempt) {
				if (trigger.triggered || !matchesAnchor(spec.anchor, attempt)) return;
				trigger.fired(env.ledger.recordFault({ strategy: "delay", anchor: label }));
				await env.sleeper.sleep(spec.delayMs);
			},
		});
		return { outcome: trigger.outcome, dispose };
	},
};
