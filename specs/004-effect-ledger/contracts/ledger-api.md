# Contract: Ledger & Instrumentation API (`@replayguard/core`)

```ts
export interface Clock { now(): number }
export const systemClock: Clock;
export function manualClock(start?: number): Clock & { advance(ms: number): void; set(ms: number): void };

export class EffectLedger {
  constructor(options?: { clock?: Clock });
  beginRun(): number;                                   // returns runIndex
  endRun(reason: RunEndReason): void;
  markRunDead(runIndex: number): void;
  isRunDead(runIndex?: number): boolean;
  readonly currentRun: number;
  recordFault(input: { strategy: string; anchor: string }): FaultEvent;
  subscribe(listener: (event: LedgerEvent) => void): () => void;
  addHooks(hooks: EffectHooks): () => void;
  attempts(): readonly EffectAttempt[];
  byIdentity(identity: string): readonly EffectAttempt[];
  overlapping(identity: string): ReadonlyArray<readonly [EffectAttempt, EffectAttempt]>;
  snapshot(): LedgerSnapshot;
  finalize(): LedgerSnapshot;
}

export interface EffectHooks {
  beforeStart?(call: PendingCall): void | Promise<void>;     // throw CrashSignal → call never starts
  inFlight?(attempt: Readonly<EffectAttempt>): void | Promise<void>; // await → provider hang
  afterSettle?(attempt: Readonly<EffectAttempt>): void | Promise<void>; // throw → lost response / crash after; await → sync point
}

export interface InstrumentOptions<A extends readonly unknown[], R> {
  kind: string;
  subject?: (...args: A) => string;
  idempotencyKey?: (...args: A) => string | undefined;
  isDeduplicated?: (result: R, ...args: A) => boolean;
  preview?: (...args: A) => unknown;
}

export function instrument<A extends readonly unknown[], R>(
  ledger: EffectLedger,
  fn: (...args: A) => R | Promise<R>,
  options: InstrumentOptions<A, R>,
): (...args: A) => Promise<R>;

export class ReplayGuardError extends Error { readonly code: string }
export class ConfigError extends ReplayGuardError {}      // RG_CONFIG*
export class CrashSignal extends ReplayGuardError {}      // RG_CRASH
export class HarnessError extends ReplayGuardError {}     // RG_HARNESS
export class BudgetExceededError extends ReplayGuardError {} // RG_BUDGET
```

## Call sequence (instrument)

1. If `ledger.isRunDead()` → throw `CrashSignal` (no attempt recorded).
2. Build `PendingCall`; run all `beforeStart` hooks in registration order.
3. `startAttempt` → emit `attempt-started`.
4. Run `inFlight` hooks (awaited).
5. Invoke `fn`; on resolve → status `deduplicated` if `isDeduplicated` true else `applied`;
   on throw → `failed`.
6. Emit `attempt-settled`; run `afterSettle` hooks (may throw).
7. Return result / rethrow original error.
