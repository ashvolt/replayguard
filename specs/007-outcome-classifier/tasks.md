---

description: "Task list for 007-outcome-classifier"
---

# Tasks: Outcome Classifier & Verdict Policy

**Input**: Design documents from `/specs/007-outcome-classifier/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (test-first, property-based, mutation ≥ 85%).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create `classifier/` module and exports in packages/core/src/classifier/index.ts
- [ ] T002 [P] Create fast-check arbitraries for ledger snapshots and case results in packages/core/test/classifier/arbitraries.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T003 Define Outcome, VerdictLevel, Evidence, EffectClassification, CaseClassification, ClassifiedResult types in packages/core/src/classifier/types.ts
- [ ] T004 [P] Write failing evidence builder tests (applied/dedup/failed counts, expected from baseline, overlaps with positive length, keys, unsettled, workflowState mapping) in packages/core/test/classifier/evidence.test.ts
- [ ] T005 Implement evidence builder in packages/core/src/classifier/evidence.ts

---

## Phase 3: User Story 1 - Classify every effect in every case (Priority: P1) 🎯 MVP

**Goal**: One outcome per identity per case via ordered rules.

**Independent Test**: Spike-shaped snapshots classify to expected outcomes.

- [ ] T006 [P] [US1] Write failing rule tests, one table per rule incl. boundaries (expected 0/1/N) in packages/core/test/classifier/rules.test.ts
- [ ] T007 [P] [US1] Write failing spike classification tests (H1 duplicated, H1b deduplicated, H3a concurrent-duplicate, H3b orphaned, skipped synthetic) in packages/core/test/classifier/classify.spike.test.ts
- [ ] T008 [P] [US1] Write failing property tests (exactly one outcome per identity; applied > expected without dedup never exactly-once/deduplicated) in packages/core/test/classifier/classify.property.test.ts
- [ ] T009 [US1] Implement OutcomeRule specifications and severity order in packages/core/src/classifier/rules.ts
- [ ] T010 [US1] Implement `classify()` producing CaseClassification per case in packages/core/src/classifier/classify.ts

---

## Phase 4: User Story 2 - Pass/fail verdicts with a strict default (Priority: P1)

**Goal**: Default policy verdicts at effect, case, scenario level.

**Independent Test**: One duplicated payment → scenario `fail` listing it.

- [ ] T011 [P] [US2] Write failing verdict aggregation tests (worst wins, harness-error case fails, warn does not fail scenario) in packages/core/test/classifier/verdict.test.ts
- [ ] T012 [US2] Implement DEFAULT_POLICY and verdict aggregation in packages/core/src/classifier/policy.ts and packages/core/src/classifier/classify.ts

---

## Phase 5: User Story 3 - Override the policy per effect (Priority: P2)

**Goal**: Kind and identity overrides via resolver chain.

**Independent Test**: `{ kinds: { email: { duplicated: "pass" } } }` passes duplicate emails only.

- [ ] T013 [P] [US3] Write failing policy tests (identity > kind > default precedence, Valibot validation of unknown outcomes) in packages/core/test/classifier/policy.test.ts
- [ ] T014 [US3] Implement policy schema and `resolveVerdict` chain in packages/core/src/classifier/policy.ts

---

## Phase 6: User Story 4 - Explain why (Priority: P2)

**Goal**: Deterministic causal explanations.

**Independent Test**: Duplicated-by-crash explanation names fault, applied attempt, re-execution.

- [ ] T015 [P] [US4] Write failing explanation tests per outcome in packages/core/test/classifier/explain.test.ts
- [ ] T016 [US4] Implement explanation templates in packages/core/src/classifier/explain.ts

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T017 [P] Baseline anomaly reporting and in-flight-at-end warnings with tests in packages/core/src/classifier/classify.ts and packages/core/test/classifier/anomalies.test.ts
- [ ] T018 [P] Performance test: 100 cases < 100 ms in packages/core/test/classifier/perf.test.ts
- [ ] T019 [P] Outcome reference docs in docs/concepts/outcomes.md
- [ ] T020 Add `run({ classify: true, policy })` convenience in packages/core/src/scenario/builder.ts with test in packages/core/test/scenario/builder.classify.test.ts
- [ ] T021 Author diagrams covering T001–T022 in specs/007-outcome-classifier/diagram.yaml
- [ ] T022 Validate quickstart table in specs/007-outcome-classifier/quickstart.md

## Dependencies & Execution Order

- Requires 004 types and 006 result types. Foundational → US1 → US2 → US3/US4 → Polish.

## Parallel Example

```bash
Task: "T006 rules tests"  Task: "T007 spike tests"  Task: "T008 property tests"
```

## Implementation Strategy

MVP = US1 + US2.
