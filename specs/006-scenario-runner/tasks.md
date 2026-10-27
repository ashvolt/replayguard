---

description: "Task list for 006-scenario-runner"
---

# Tasks: Scenario Runner & Fault Matrix

**Input**: Design documents from `/specs/006-scenario-runner/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (test-first).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create `runtime/` and `scenario/` modules with barrel exports in packages/core/src/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T002 Define `WorkflowRuntime`, `RuntimeCase`, `RunOutcome` port types in packages/core/src/runtime/port.ts
- [ ] T003 [P] Implement an in-memory fake runtime for unit tests (scripted outcomes, crash on demand) in packages/core/test/support/fake-runtime.ts
- [ ] T004 Define ScenarioDefinition, EffectContext, Budget ("maxRuns 1–1000 = 20, caseTimeoutMs 1–600000 = 10000, graceMs 0–10000 = 25"), ExploreOptions ("maxCases 1–500 = 50"), CaseResult, ScenarioResult types in packages/core/src/scenario/types.ts and packages/core/src/scenario/result.ts

**Checkpoint**: Runner can be unit-tested against a fake runtime.

---

## Phase 3: User Story 1 - Run one explicit fault scenario (Priority: P1) 🎯 MVP

**Goal**: Baseline + explicit cases with restart loop, retry waits and budgets.

**Independent Test**: Spike H1 through the runner → 2 applied, 1 restart, completed.

- [ ] T005 [P] [US1] Write failing runner lifecycle tests with fake runtime (baseline first, crash → restart, sleeping → wait until wakeAt, waiting → settle, budget-exceeded on maxRuns and timeout, grace period captures late completion, harness error isolation) in packages/core/test/scenario/runner.test.ts
- [ ] T006 [US1] Implement `ScenarioRunner.runCase` template method and `run()` in packages/core/src/scenario/runner.ts
- [ ] T007 [US1] Implement `EffectContext` creation (bound instrument, ledger, clock, sleeper, caseIndex) in packages/core/src/scenario/context.ts
- [ ] T008 [P] [US1] Write failing engine runtime tests (yield-mode mapping completed/sleeping/waiting/crashed/failed, fresh InMemoryDriver per case wrapped in FaultyDriver, fixed workflowId) in packages/adapter-workflows/test/runtime.test.ts
- [ ] T009 [US1] Implement `workflowsRuntime()` in packages/adapter-workflows/src/runtime.ts
- [ ] T010 [US1] Implement `workflowsProcessRuntime()` spawning per run via 005 child host in packages/adapter-workflows/src/process/process-runtime.ts
- [ ] T011 [US1] Write end-to-end test: explicit crash case with real engine in packages/adapter-workflows/test/scenario.e2e.test.ts

---

## Phase 4: User Story 2 - Automatically explore all fault points (Priority: P1)

**Goal**: Discovery + budgeted, deterministic matrix.

**Independent Test**: 2 effects × 2 points × 2 strategies → 8 explored cases in deterministic order.

- [ ] T012 [P] [US2] Write failing discovery tests (occurrences from baseline in seq order, parallel branches ordering) in packages/core/test/scenario/discovery.test.ts
- [ ] T013 [P] [US2] Write failing matrix tests incl. fast-check (count, ordering after→before then strategy order, dedupe vs explicit, budget truncation reports skipped, delay only with delayMs, processKill only with process runtime) in packages/core/test/scenario/matrix.test.ts
- [ ] T014 [US2] Implement discovery in packages/core/src/scenario/discovery.ts
- [ ] T015 [US2] Implement matrix generation in packages/core/src/scenario/matrix.ts
- [ ] T016 [US2] Integrate exploration into runner, generated case names (`crash@after:payment.charge#1`) and `baselineClean: false` flag when the baseline failed in packages/core/src/scenario/runner.ts

---

## Phase 5: User Story 3 - Fluent, validated scenario definition (Priority: P2)

**Goal**: Typed builder with build-time validation.

**Independent Test**: Missing workflow → ConfigError naming the field.

- [ ] T017 [P] [US3] Write failing builder tests (required fields, duplicate case names, processKill without process runtime, generics inference via expectTypeOf) in packages/core/test/scenario/builder.test.ts
- [ ] T018 [US3] Implement Valibot option schema in packages/core/src/scenario/schema.ts
- [ ] T019 [US3] Implement `scenario()` builder and `Scenario.run()` in packages/core/src/scenario/builder.ts

---

## Phase 6: User Story 4 - Isolated, repeatable cases (Priority: P2)

**Goal**: Fresh state per case; seeded determinism.

**Independent Test**: Run twice → identical results excluding timestamps.

- [ ] T020 [P] [US4] Write failing isolation tests (factories called per case, no shared fake state) in packages/core/test/scenario/isolation.test.ts
- [ ] T021 [P] [US4] Write repeatability test (100 runs same seed → identical case order and statuses) in packages/adapter-workflows/test/repeatability.test.ts
- [ ] T022 [US4] Implement seeded ordering utility (mulberry32) used for sampling ties in packages/core/src/scenario/seed.ts

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T023 [P] Scripted message delivery (`deliver(name, body, afterRun)`) with tests in packages/core/src/scenario/runner.ts and packages/core/test/scenario/messages.test.ts
- [ ] T024 [P] Performance test: 20 in-process cases < 5 s in packages/adapter-workflows/test/perf.test.ts
- [ ] T025 [P] Guide "Writing scenarios" in docs/guides/scenarios.md
- [ ] T026 Author diagrams covering T001–T027 in specs/006-scenario-runner/diagram.yaml
- [ ] T027 Validate quickstart scenarios in specs/006-scenario-runner/quickstart.md

## Dependencies & Execution Order

- Requires 004 and 005 foundational/US1. Foundational → US1 → US2 → US3 → US4 → Polish.
- T010 depends on 005 T027 (child host); 005 T028 depends on T010 contract — implement together.

## Parallel Example

```bash
Task: "T012 discovery tests"  Task: "T013 matrix tests"  Task: "T017 builder tests"
```

## Implementation Strategy

MVP = US1 + US2 (explicit + explored cases on engine runtime).
