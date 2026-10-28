import { SimulatedNetworkError } from "../errors.js";
import { createTrigger, type FaultStrategy, matchesAnchor } from "../strategy.js";
import { describeFault } from "../types.js";

/**
 * Lost response: the provider applies the anchored attempt, then the caller receives an error
 * (default `SimulatedNetworkError`), so the workflow's retry logic runs.
 *
 * @example
 * new FaultController([throwAfterStrategy]).arm([fault.loseResponse("email.send")], env);
 */
export const throwAfterStrategy: FaultStrategy = {
	name: "throwAfter",
	requiresProcessIsolation: false,
	arm(spec, env, specIndex) {
		if (spec.strategy !== "throwAfter")
			throw new TypeError("throwAfterStrategy armed with another spec");
		const trigger = createTrigger(specIndex, "throwAfter");
		const label = describeFault(spec);
		const dispose = env.ledger.addHooks({
			afterSettle(attempt) {
				if (
					trigger.triggered ||
					attempt.status === "failed" ||
					!matchesAnchor(spec.anchor, attempt)
				)
					return;
				trigger.fired(env.ledger.recordFault({ strategy: "throwAfter", anchor: label }));
				throw spec.error ? spec.error() : new SimulatedNetworkError(label);
			},
		});
		return { outcome: trigger.outcome, dispose };
	},
};
