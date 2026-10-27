---

description: "Task list for 004-effect-ledger"
---

# Tasks: Effect Ledger & Instrumentation

**Input**: Design documents from `/specs/004-effect-ledger/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (test-first).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create module folders `ports/`, `ledger/`, `instrument/` and barrel exports in packages/core/src/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T002 [P] Write failing tests for error hierarchy (`ReplayGuardError` with stable `code`, `ConfigError`, `CrashSignal`, `HarnessError`, `BudgetExceededError`, `SchemaError`) in packages/core/test/errors.test.ts
- [ ] T003 Implement error hierarchy in packages/core/src/errors.ts
- [ ] T004 [P] Write failing tests for `systemClock` monotonicity and `manualClock` advance/set in packages/core/test/clock.test.ts
- [ ] T005 Implement `Clock`, `systemClock`, `manualClock` in packages/core/src/ports/clock.ts
- [ ] T006 [P] Write failing canonical serialization + FNV-1a-64 tests incl. fast-check (key-order independence, Date/Map/Set handling, unhashable → `RG_CONFIG_UNHASHABLE`) in packages/core/test/canonical.test.ts
- [ ] T007 Implement `canonicalize` and `canonicalHash` in packages/core/src/ledger/canonical.ts
- [ ] T008 Define ledger types (EffectAttempt status machine "started → applied | deduplicated | failed", RunRecord, FaultEvent, LedgerEvent, LedgerSnapshot version 1, PendingCall) in packages/core/src/ledger/types.ts

**Checkpoint**: Primitives ready.

---

## Phase 3: User Story 1 - Instrument my own side-effect function (Priority: P1) 🎯 MVP

**Goal**: Wrapper records attempts transparently with logical identity.

**Independent Test**: 3 calls with 2 argument sets → 3 attempts, 2 identities; return values/errors unchanged.

- [ ] T009 [P] [US1] Write failing ledger core tests (beginRun/endRun, startAttempt/settleAttempt transitions, seq monotonic, kind/identity occurrences, snapshot deep-frozen) in packages/core/test/ledger.test.ts
- [ ] T010 [P] [US1] Write failing instrument tests (return passthrough, error rethrow unchanged, identity default/custom subject, sync return values, kind validation "1–64 chars") in packages/core/test/instrument.test.ts
- [ ] T011 [US1] Implement `EffectLedger` attempt/run recording and snapshot in packages/core/src/ledger/ledger.ts
- [ ] T012 [US1] Implement `instrument()` call sequence (contracts/ledger-api.md steps 1–7) in packages/core/src/instrument/instrument.ts
- [ ] T013 [US1] Add fast-check property: every call yields exactly one settled attempt with matching status in packages/core/test/instrument.property.test.ts

---

## Phase 4: User Story 2 - Record provider-side deduplication (Priority: P1)

**Goal**: `idempotencyKey` and `isDeduplicated` options mark attempts `deduplicated`.

**Independent Test**: Same key twice with dedup detector → 1 applied + 1 deduplicated.

- [ ] T014 [P] [US2] Write failing tests for idempotency key extraction ("≤ 255 chars") and dedup detection in packages/core/test/instrument.dedup.test.ts
- [ ] T015 [US2] Implement key extraction and `deduplicated` status in packages/core/src/instrument/instrument.ts
- [ ] T016 [US2] Implement count queries (applied, deduplicated per identity) in packages/core/src/ledger/queries.ts with tests in packages/core/test/queries.test.ts

---

## Phase 5: User Story 3 - Observe in-flight effects at the moment of a fault (Priority: P1)

**Goal**: Fault events flag in-flight attempts; late completions recorded; overlaps queryable.

**Independent Test**: Slow attempt + recordFault → `inFlightAtFaults` set; completion after settle recorded.

- [ ] T017 [P] [US3] Write failing tests for `recordFault`, in-flight flagging, `markRunDead`/`isRunDead` (dead run throws `CrashSignal` before start), late completion until `finalize()` in packages/core/test/ledger.faults.test.ts
- [ ] T018 [P] [US3] Write failing overlap query tests incl. property (symmetry, zero-length intervals excluded) in packages/core/test/queries.overlap.test.ts
- [ ] T019 [US3] Implement fault recording, dead runs and finalize in packages/core/src/ledger/ledger.ts
- [ ] T020 [US3] Implement `overlapping(identity)` in packages/core/src/ledger/queries.ts

---

## Phase 6: User Story 4 - Subscribe to effects as they happen (Priority: P2)

**Goal**: Synchronous observers and control-flow hooks.

**Independent Test**: Listener receives `attempt-started` then `attempt-settled` before call returns; throwing hook propagates, throwing observer does not.

- [ ] T021 [P] [US4] Write failing tests for `subscribe` ordering/unsubscribe and observer error isolation in packages/core/test/ledger.subscribe.test.ts
- [ ] T022 [P] [US4] Write failing tests for `addHooks` (`beforeStart` throw prevents start, `inFlight` await delays, `afterSettle` throw propagates after attempt recorded, async `afterSettle` awaited) in packages/core/test/ledger.hooks.test.ts
- [ ] T023 [US4] Implement observers and hooks in packages/core/src/ledger/ledger.ts and wire into packages/core/src/instrument/instrument.ts

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T024 [P] Implement opt-in `preview` option (no raw args stored by default) with tests in packages/core/src/instrument/instrument.ts and packages/core/test/instrument.preview.test.ts
- [ ] T025 [P] Add overhead benchmark (< 1 ms per call) in packages/core/test/instrument.bench.test.ts
- [ ] T026 [P] TSDoc with `@example` for all exports and concept guide in docs/concepts/effects.md
- [ ] T027 Author diagrams covering T001–T028 in specs/004-effect-ledger/diagram.yaml
- [ ] T028 Validate quickstart scenarios in specs/004-effect-ledger/quickstart.md

## Dependencies & Execution Order

- Requires 003 T003 (core scaffold).
- Foundational → US1 → US2 → US3 → US4 → Polish (US2–US4 touch ledger.ts sequentially).

## Parallel Example

```bash
Task: "T002 errors tests"  Task: "T004 clock tests"  Task: "T006 canonical tests"
```

## Implementation Strategy

MVP = US1 + US2 + US3 (needed by faults and classifier).
