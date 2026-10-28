import type { EffectLedger } from "../ledger/ledger.js";
import type { FaultEvent } from "../ledger/types.js";
import type { PersistenceControl } from "../ports/persistence.js";
import type { Sleeper } from "../ports/sleeper.js";
import type { EffectAnchor, FaultOutcome, FaultSpec, StrategyName } from "./types.js";

/** What a strategy may act on while armed. */
export interface FaultEnvironment {
	/** Ledger of the case (hooks are registered here). */
	ledger: EffectLedger;
	/** Durable storage control provided by the runtime adapter. */
	persistence: PersistenceControl;
	/** Waiting port (used by `delay`). */
	sleeper: Sleeper;
	/** Whether the runtime runs each run in a separate OS process. */
	processIsolated: boolean;
}

/** A fault armed for one case. */
export interface ArmedFault {
	/** Current outcome (triggered or not). */
	outcome(): FaultOutcome;
	/** Removes hooks and listeners. */
	dispose(): void;
}

/**
 * A fault mechanic (Strategy pattern): arms on an anchor and fires at most once.
 *
 * @example
 * const controller = new FaultController([...DEFAULT_STRATEGIES, processKillStrategy]);
 */
export interface FaultStrategy {
	/** Strategy name matched against `FaultSpec.strategy`. */
	readonly name: StrategyName;
	/** Whether the strategy needs each run in its own OS process. */
	readonly requiresProcessIsolation: boolean;
	/** Arms the spec in the given environment. */
	arm(spec: FaultSpec, env: FaultEnvironment, specIndex: number): ArmedFault;
}

/** Fire-once bookkeeping shared by strategies. */
export interface Trigger {
	/** Whether the fault already fired. */
	readonly triggered: boolean;
	/** Records the firing. */
	fired(fault: FaultEvent): void;
	/** Current outcome. */
	outcome(): FaultOutcome;
}

/**
 * Creates fire-once bookkeeping for a strategy implementation.
 *
 * @example
 * const trigger = createTrigger(specIndex, "crash");
 */
export function createTrigger(specIndex: number, strategy: StrategyName): Trigger {
	let fault: FaultEvent | undefined;
	return {
		get triggered() {
			return fault !== undefined;
		},
		fired(event) {
			fault = event;
		},
		outcome: () =>
			fault === undefined
				? { specIndex, strategy, triggered: false }
				: {
						specIndex,
						strategy,
						triggered: true,
						faultId: fault.id,
						runIndex: fault.runIndex,
						at: fault.at,
					},
	};
}

/** Whether an attempt or pending call is the anchored occurrence. */
export function matchesAnchor(
	anchor: EffectAnchor,
	call: { kind: string; identity: string; kindOccurrence: number; identityOccurrence: number },
): boolean {
	return "kind" in anchor
		? call.kind === anchor.kind && call.kindOccurrence === anchor.occurrence
		: call.identity === anchor.identity && call.identityOccurrence === anchor.occurrence;
}
