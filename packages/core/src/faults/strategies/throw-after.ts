import { SimulatedNetworkError } from "../errors.js";
import { createTrigger, type FaultStrategy, matchesAnchor } from "../strategy.js";
import { describeFault } from "../types.js";

/**
 * Network failure at an effect boundary. `after` (default): the provider applies the anchored
 * attempt, then the caller receives an error (lost response). `before`: the request never reaches
 * the provider and the caller receives an error (lost request). Default error:
 * `SimulatedNetworkError`.
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
		const fire = () => {
			trigger.fired(env.ledger.recordFault({ strategy: "throwAfter", anchor: label }));
			return spec.error ? spec.error() : new SimulatedNetworkError(label);
		};
		const dispose = env.ledger.addHooks(
			spec.point === "before"
				? {
						beforeStart(call) {
							if (!trigger.triggered && matchesAnchor(spec.anchor, call)) throw fire();
						},
					}
				: {
						afterSettle(attempt) {
							if (
								!trigger.triggered &&
								attempt.status !== "failed" &&
								matchesAnchor(spec.anchor, attempt)
							) {
								throw fire();
							}
						},
					},
		);
		return { outcome: trigger.outcome, dispose };
	},
};
