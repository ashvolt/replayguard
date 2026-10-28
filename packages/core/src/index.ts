export {
	BudgetExceededError,
	ConfigError,
	CrashSignal,
	HarnessError,
	ReplayGuardError,
	SchemaError,
	type SerializedError,
	serializeError,
} from "./errors.js";
export { type ArmedFaults, DEFAULT_STRATEGIES, FaultController } from "./faults/controller.js";
export { SimulatedNetworkError } from "./faults/errors.js";
export { crashStrategy } from "./faults/strategies/crash.js";
export { delayStrategy } from "./faults/strategies/delay.js";
export { noneStrategy } from "./faults/strategies/none.js";
export { throwAfterStrategy } from "./faults/strategies/throw-after.js";
export {
	type ArmedFault,
	createTrigger,
	type FaultEnvironment,
	type FaultStrategy,
	matchesAnchor,
	type Trigger,
} from "./faults/strategy.js";
export {
	type CrashSpec,
	type DelaySpec,
	describeFault,
	type EffectAnchor,
	type FaultAnchor,
	type FaultOutcome,
	type FaultPoint,
	type FaultSpec,
	fault,
	type IdentityAnchor,
	type KindAnchor,
	type NoFaultSpec,
	type ProcessKillSpec,
	type StrategyName,
	type ThrowAfterSpec,
	validateFaultSpec,
	type WriteAnchor,
} from "./faults/types.js";
export { type InstrumentOptions, instrument } from "./instrument/instrument.js";
export { canonicalHash, canonicalize, fnv1a64 } from "./ledger/canonical.js";
export { EffectLedger } from "./ledger/ledger.js";
export { appliedCount, deduplicatedCount, overlapping } from "./ledger/queries.js";
export type {
	AttemptSettledEvent,
	AttemptStartedEvent,
	AttemptStatus,
	EffectAttempt,
	EffectHooks,
	FaultEvent,
	FaultRecordedEvent,
	LedgerEvent,
	LedgerSnapshot,
	PendingCall,
	RunEndedEvent,
	RunEndReason,
	RunRecord,
	RunStartedEvent,
} from "./ledger/types.js";
export { type Clock, type ManualClock, manualClock, systemClock } from "./ports/clock.js";
export type { PersistenceControl } from "./ports/persistence.js";
export { type ManualSleeper, manualSleeper, type Sleeper, systemSleeper } from "./ports/sleeper.js";
