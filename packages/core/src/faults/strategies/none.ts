import type { FaultStrategy } from "../strategy.js";

/**
 * Null Object strategy: arms nothing and never fires (baseline cases).
 *
 * @example
 * new FaultController([noneStrategy]).arm([fault.none()], env);
 */
export const noneStrategy: FaultStrategy = {
	name: "none",
	requiresProcessIsolation: false,
	arm: (_spec, _env, specIndex) => ({
		outcome: () => ({ specIndex, strategy: "none", triggered: false }),
		dispose: () => undefined,
	}),
};
