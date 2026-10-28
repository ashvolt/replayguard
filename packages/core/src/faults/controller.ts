import { ConfigError } from "../errors.js";
import { crashStrategy } from "./strategies/crash.js";
import { delayStrategy } from "./strategies/delay.js";
import { noneStrategy } from "./strategies/none.js";
import { throwAfterStrategy } from "./strategies/throw-after.js";
import type { ArmedFault, FaultEnvironment, FaultStrategy } from "./strategy.js";
import { type FaultOutcome, type FaultSpec, validateFaultSpec } from "./types.js";

/** In-process strategies registered by default (process kill lives in adapter packages). */
export const DEFAULT_STRATEGIES: readonly FaultStrategy[] = [
	noneStrategy,
	crashStrategy,
	throwAfterStrategy,
	delayStrategy,
];

/** Faults armed for one case. */
export interface ArmedFaults {
	/** Outcome per spec, in spec order. */
	outcomes(): FaultOutcome[];
	/** Disarms every fault. */
	dispose(): void;
}

/**
 * Arms fault specs on a case's ledger and persistence using registered strategies.
 *
 * @example
 * const armed = new FaultController().arm([fault.crashAfter("payment.charge")], env);
 * // … run the workflow …
 * armed.outcomes(); // [{ triggered: true, faultId: "F1", … }]
 */
export class FaultController {
	readonly #strategies = new Map<string, FaultStrategy>();

	constructor(strategies: readonly FaultStrategy[] = DEFAULT_STRATEGIES) {
		for (const strategy of strategies) this.#strategies.set(strategy.name, strategy);
	}

	/** Names of registered strategies, in registration order. */
	strategyNames(): string[] {
		return [...this.#strategies.keys()];
	}

	/** Validates and arms every spec; throws `ConfigError` for invalid or unsupported specs. */
	arm(specs: readonly FaultSpec[], env: FaultEnvironment): ArmedFaults {
		const plan = specs.map((spec) => {
			validateFaultSpec(spec);
			const strategy = this.#strategies.get(spec.strategy);
			if (!strategy)
				throw new ConfigError(
					`no fault strategy registered for "${spec.strategy}"`,
					"RG_CONFIG_FAULT",
				);
			if (strategy.requiresProcessIsolation && !env.processIsolated) {
				throw new ConfigError(
					`fault "${spec.strategy}" requires a process-isolated runtime`,
					"RG_CONFIG_FAULT",
				);
			}
			return { spec, strategy };
		});
		const armed: ArmedFault[] = plan.map(({ spec, strategy }, i) => strategy.arm(spec, env, i));
		return {
			outcomes: () => armed.map((a) => a.outcome()),
			dispose: () => {
				for (const a of armed) a.dispose();
			},
		};
	}
}
