# Research: Scenario Runner

## R1 — Driving the engine like a host

- **Decision**: Use `runWorkflow(id, fn, input, driver, { mode: "yield" })`. Map results:
  `completed` → completed; `sleeping` with `sleepUntil` → wait then rerun; waiting for messages →
  `waiting` (deliver scripted messages if configured, else settle); rejection with
  `persistence.crashed` or `CrashSignal` → crashed → `persistence.restart()` and rerun; other
  rejection → failed.
- **Rationale**: Spike harness proved this loop reproduces host behavior deterministically.

## R2 — Time

- **Decision**: Runner waits via `Sleeper` (real timers in production, manual in unit tests).
  Engine reads `Date.now()`, so integration tests use small backoff values.
- **Alternative**: Fake timers (`vi.useFakeTimers`) — engine internals mix timers and promises;
  brittle.

## R3 — Discovery & matrix ordering

- **Decision**: From baseline attempts (any status), occurrences = distinct
  `(kind, kindOccurrence)` in seq order. Candidates = occurrence × point × strategy, ordered by
  (point: after → before), (strategy order as configured, default `crash`, `throwAfter`), then
  occurrence seq. Explicit cases are run first and removed from candidates (structural equality).
  Budget truncates; truncated list returned as `skipped`.
- `delay` is generated only when `explore.delayMs` is set; `processKill` only with a process
  runtime.

## R4 — Budgets

- **Decision**: Defaults `maxRuns: 20`, `caseTimeoutMs: 10_000`, `graceMs: 25`; exceeding →
  `budget-exceeded` with partial ledger. Time budget enforced with `Promise.race` against the
  sleeper; abandoned runs are marked dead in the ledger so late effects are flagged.

## R5 — Effects factory contract

- **Decision**: `effects: (ctx: EffectContext) => TEffects`; `EffectContext = { instrument,
  ledger, clock, sleeper, caseIndex }`; workflow factory `workflow: (effects: TEffects) =>
  WorkflowFn`. Both called once per case.

## R6 — Workflow ID

- **Decision**: Fixed per scenario (`options.workflowId`, default `"replayguard-wf"`) so
  idempotency keys derived from it are stable across runs/restarts within a case.

## R7 — Implementation refinements (2026-10-28)

- `PrepareCaseInput` carries `effectContext`, `build(ctx)` and `faults`: in-process runtimes build
  the workflow in the parent; the process runtime rebuilds it in the child from the scenario module.
- `WorkflowRuntime.strategies` lets a runtime contribute fault strategies (`processKill`).
- The engine reports a queue wait as `sleeping` with `waitingForMessages` and no `sleepUntil`; the
  adapter maps that to `waiting`.
- Case timeouts use a real timer (budgets are wall-clock by nature); retries wait through the
  injected `Sleeper`.
