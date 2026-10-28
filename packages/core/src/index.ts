export { classify } from "./classifier/classify.js";
export { buildEvidence, expectedCounts } from "./classifier/evidence.js";
export { explain } from "./classifier/explain.js";
export {
	DEFAULT_POLICY,
	resolveVerdict,
	validatePolicy,
	worstVerdict,
} from "./classifier/policy.js";
export {
	classifyEvidence,
	OUTCOME_RULES,
	OUTCOME_SEVERITY,
	type OutcomeRule,
} from "./classifier/rules.js";
export type {
	CaseClassification,
	ClassifiedResult,
	EffectClassification,
	Evidence,
	Outcome,
	OutcomeVerdicts,
	Policy,
	VerdictLevel,
	WorkflowStateForEvidence,
} from "./classifier/types.js";
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
export { crashStrategy, createCrashStrategy } from "./faults/strategies/crash.js";
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
export type { FixHint } from "./hints/types.js";
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
export type {
	CompletedOutcome,
	CrashedOutcome,
	FailedOutcome,
	PrepareCaseInput,
	RunOutcome,
	RuntimeCase,
	SleepingOutcome,
	WaitingOutcome,
	WorkflowRuntime,
} from "./runtime/port.js";
export {
	type ClassifyRunOptions,
	type Scenario,
	ScenarioBuilder,
	scenario,
} from "./scenario/builder.js";
export { createEffectContext } from "./scenario/context.js";
export { discoverOccurrences, type Occurrence } from "./scenario/discovery.js";
export type { MatrixResult } from "./scenario/matrix.js";
export { buildMatrix, type MatrixInput } from "./scenario/matrix.js";
export type {
	CaseOrigin,
	CaseResult,
	CaseStatus,
	ScenarioIdentity,
	ScenarioResult,
	SkippedCase,
} from "./scenario/result.js";
export { type RunOptions, ScenarioRunner } from "./scenario/runner.js";
export { validateScenarioOptions } from "./scenario/schema.js";
export { mulberry32 } from "./scenario/seed.js";
export {
	type Budget,
	type CaseDefinition,
	DEFAULT_BUDGET,
	DEFAULT_EXPLORE,
	type EffectContext,
	type ExploreOptions,
	type ExploreStrategy,
	type ScenarioDefinition,
	type ScriptedMessage,
} from "./scenario/types.js";
