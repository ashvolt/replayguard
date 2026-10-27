# Implementation Plan: Effect Ledger & Instrumentation

**Branch**: `004-effect-ledger` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-effect-ledger/spec.md`

## Summary

`@replayguard/core` gains the `EffectLedger` (ordered store of runs, attempts and fault events,
with synchronous subscriptions and fault hooks), the `instrument()` wrapper, canonical subject
hashing, injectable `Clock`, typed errors and a serializable snapshot. Fault strategies (005)
plug in through ledger hooks; reporters/classifier (007, 009) consume snapshots.

## Technical Context

**Language/Version**: TypeScript ~6.0, ES2023, ESM + CJS via tsup

**Primary Dependencies**: none (pure TS, no `node:*` imports)

**Storage**: In-memory only

**Testing**: Vitest unit tests, fast-check properties (hash stability/canonical ordering, every
call recorded exactly once, overlap symmetry), manual clock for determinism

**Target Platform**: Node ≥ 22 (core is runtime-agnostic: also works in Bun/Deno/browsers)

**Project Type**: Library package

**Performance Goals**: < 1 ms overhead per instrumented call (SC-003)

**Constraints**: No raw argument storage by default; no globals; ledger events synchronous

**Scale/Scope**: up to ~10k attempts per scenario

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | No arg values stored unless `preview` opted in; no I/O | PASS |
| II Test-first | Unit + property tests; manual clock | PASS |
| III Modularity | Lives in core, no imports beyond core | PASS |
| IV Patterns | Observer, hooks (Strategy seam) recorded below | PASS |
| V Public API | N/A in this feature | PASS |
| VI Types | Generic `instrument` preserves argument/return types; typed errors | PASS |
| VII Traceability | diagram.yaml + tasks | PASS |
| VIII Docs | TSDoc + `docs/concepts/effects.md` | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Many consumers (reporters, runner, process relay) need effect events without coupling | **Observer** (`ledger.subscribe`) | Consumers polling snapshots — misses ordering and in-flight state |
| Faults must act *inside* an effect call (before start, while in flight, after settle) | **Hook interface** consumed by fault **Strategies** (`EffectHooks`) | Faults wrapping user functions themselves — would duplicate instrumentation |
| Time must be controllable in tests | **Ports & Adapters** (`Clock`) | Direct `performance.now()` — nondeterministic tests |
| Unhashable inputs fail loudly | **Fail-fast guard** in canonical serializer | Silent `String(x)` fallback — merges distinct effects |

## Project Structure

```text
packages/core/src/
├── errors.ts                 # ReplayGuardError, ConfigError, CrashSignal, codes
├── ports/clock.ts            # Clock, systemClock, manualClock
├── ledger/
│   ├── types.ts              # EffectAttempt, FaultEvent, RunRecord, LedgerEvent, LedgerSnapshot
│   ├── canonical.ts          # canonical serialization + FNV-1a 64 hash
│   ├── ledger.ts             # EffectLedger
│   └── queries.ts            # byIdentity, overlapping, counts
├── instrument/instrument.ts  # instrument()
└── index.ts
packages/core/test/
├── errors.test.ts  clock.test.ts  canonical.test.ts  canonical.property.test.ts
├── ledger.test.ts  queries.test.ts  instrument.test.ts  instrument.property.test.ts
```

**Structure Decision**: Feature code in `packages/core` under `ledger/` and `instrument/`.

## Complexity Tracking

No violations.
