---

description: "Task list for 005-fault-injection"
---

# Tasks: Fault Injection Strategies

**Input**: Design documents from `/specs/005-fault-injection/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (test-first). Spike F0 tests become acceptance tests.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create `faults/` module and barrel exports in packages/core/src/faults/index.ts
- [ ] T002 [P] Add `@rivet-dev/workflows` peer + dev dependency (1.x) and `/testing` usage in packages/adapter-workflows/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T003 [P] Write failing tests for `Sleeper` port (system + manual) in packages/core/test/sleeper.test.ts
- [ ] T004 Implement `Sleeper`, `systemSleeper`, `manualSleeper` in packages/core/src/ports/sleeper.ts
- [ ] T005 Define `PersistenceControl` port ("crash(), restart(), crashed, writeCount, onBeforeWrite") in packages/core/src/ports/persistence.ts
- [ ] T006 [P] Write failing tests for FaultSpec validation (exactly one of kind/identity; occurrence ≥ 1; `throwAfter` requires `after`; `delayMs` 1–600000; write anchors only for crash/processKill) and `fault.*` helpers in packages/core/test/faults/spec.test.ts
- [ ] T007 Implement FaultSpec types, Valibot validation and helpers in packages/core/src/faults/types.ts
- [ ] T008 [P] Write failing FaultController tests with a fake PersistenceControl (arms on ledger hooks, fires once, outcome triggered/not-triggered, dispose unregisters) in packages/core/test/faults/controller.test.ts
- [ ] T009 Implement `FaultStrategy`/`ArmedFault` interfaces and `FaultController` in packages/core/src/faults/strategy.ts and packages/core/src/faults/controller.ts
- [ ] T010 [P] Write failing driver conformance suite (get/set/delete/deletePrefix/deleteRange/list ordering/batch/alarms) runnable against any EngineDriver in packages/adapter-workflows/test/driver-conformance.ts
- [ ] T011 [P] Write failing FaultyDriver tests (passthrough reads, write counting across 7 write ops, crash rejects writes with CrashSignal, restart clears, onBeforeWrite index) in packages/adapter-workflows/test/faulty-driver.test.ts
- [ ] T012 Implement `FaultyDriver` decorator implementing `EngineDriver` and `PersistenceControl` in packages/adapter-workflows/src/faulty-driver.ts

**Checkpoint**: Faults can be armed; persistence can crash.

---

## Phase 3: User Story 1 - Crash right after the provider succeeded (Priority: P1) 🎯 MVP

**Goal**: `crash` strategy at effect anchors (before/after) and write anchors.

**Independent Test**: Spike H1 via public API → 2 applied payment attempts after restart.

- [ ] T013 [P] [US1] Write failing crash strategy unit tests (records fault, persistence.crash, markRunDead, throws CrashSignal; before vs after; write anchor) in packages/core/test/faults/crash.test.ts
- [ ] T014 [P] [US1] Port spike H1, H2, H4 as failing acceptance tests using FaultyDriver + crash strategy in packages/adapter-workflows/test/spike-parity.test.ts
- [ ] T015 [US1] Implement `crash` strategy in packages/core/src/faults/strategies/crash.ts
- [ ] T016 [US1] Implement `none` strategy (Null Object) in packages/core/src/faults/strategies/none.ts

---

## Phase 4: User Story 2 - Lose the provider's response (Priority: P1)

**Goal**: `throwAfter` strategy.

**Independent Test**: Spike H0 via `fault.loseResponse` → step retries, 2 applied.

- [ ] T017 [P] [US2] Write failing throwAfter tests (default SimulatedNetworkError, custom error factory, attempt stays applied) in packages/core/test/faults/throw-after.test.ts
- [ ] T018 [US2] Implement `SimulatedNetworkError` and `throwAfter` strategy in packages/core/src/faults/errors.ts and packages/core/src/faults/strategies/throw-after.ts
- [ ] T019 [US2] Add H0 acceptance test in packages/adapter-workflows/test/spike-parity.test.ts

---

## Phase 5: User Story 3 - Provider hangs past the step timeout (Priority: P1)

**Goal**: `delay` strategy keeping the call in flight.

**Independent Test**: Spike H3a/H3b → late completion recorded, overlap detected.

- [ ] T020 [P] [US3] Write failing delay tests with manual sleeper (only targeted occurrence, attempt started before delay) in packages/core/test/faults/delay.test.ts
- [ ] T021 [US3] Implement `delay` strategy in packages/core/src/faults/strategies/delay.ts
- [ ] T022 [US3] Add H3a and H3b acceptance tests in packages/adapter-workflows/test/spike-parity.test.ts

---

## Phase 6: User Story 4 - Kill the real process (Priority: P2)

**Goal**: File-backed durable storage + child-process host + kill strategy.

**Independent Test**: Process-kill H1 scenario yields same ledger outcome as in-process crash.

- [ ] T023 [P] [US4] Write failing FileDriver tests: conformance suite + reopen persistence + atomic write (temp + rename) in packages/adapter-workflows/test/file-driver.test.ts
- [ ] T024 [US4] Implement `FileDriver` (extends InMemoryDriver, `<dir>/kv.json`, latency 0) in packages/adapter-workflows/src/file-driver.ts
- [ ] T025 [P] [US4] Write failing IPC protocol schema tests (valid/invalid messages, no functions) in packages/adapter-workflows/test/process/protocol.test.ts
- [ ] T026 [US4] Implement IPC message schemas in packages/adapter-workflows/src/process/protocol.ts
- [ ] T027 [US4] Implement child host (load scenario module inside project root, build effects, relay ledger events, await `continue` after each settle) in packages/adapter-workflows/src/process/child-host.ts and packages/adapter-workflows/src/process/child-entry.ts
- [ ] T028 [US4] Implement `processKill` strategy and parent controller (fork without shell, kill at anchor, harness timeout) in packages/adapter-workflows/src/process/process-kill.ts
- [ ] T029 [US4] Write process-kill integration tests on all OSes (kill after anchor, not-triggered, hang → harness timeout, ledger parity with in-process crash for H1 per SC-002) in packages/adapter-workflows/test/process/process-kill.integration.test.ts

---

## Phase 7: User Story 5 - No-fault baseline (Priority: P2)

**Goal**: Baseline equals uninstrumented run.

**Independent Test**: `none` strategy → no fault events; outputs equal to plain run.

- [ ] T030 [US5] Write baseline equivalence test (instrumented vs plain engine run outputs) in packages/adapter-workflows/test/baseline.test.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T031 [P] Docs page per strategy with spike evidence in docs/faults/strategies.md
- [ ] T032 [P] Add Stryker 85% config coverage for packages/core/src/faults in packages/core/stryker.config.json
- [ ] T033 Author diagrams covering T001–T034 in specs/005-fault-injection/diagram.yaml
- [ ] T034 Validate quickstart spike-parity table in specs/005-fault-injection/quickstart.md

## Dependencies & Execution Order

- Requires 004 (ledger hooks, CrashSignal). Foundational → US1 → US2/US3 (parallel) → US4 → US5 → Polish.
- US4 process host also consumes 006 runtime contract (`workflowsProcessRuntime`) — implement T027/T028 after 006 T010.

## Parallel Example

```bash
Task: "T013 crash tests"  Task: "T017 throwAfter tests"  Task: "T020 delay tests"  Task: "T023 FileDriver tests"
```

## Implementation Strategy

MVP = crash + throwAfter + delay in-process. Process kill adds realism.
