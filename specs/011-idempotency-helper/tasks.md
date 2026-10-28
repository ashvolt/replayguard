---

description: "Task list for 011-idempotency-helper"
---

# Tasks: Idempotency Key Helper & Fix Hints

**Input**: Design documents from `/specs/011-idempotency-helper/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (test-first, property-based).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create `idempotency/` and `hints/` modules with exports in packages/core/src/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 Define FixHint, HintRule, HintContext types ("title ≤ 80 chars") in packages/core/src/hints/types.ts

---

## Phase 3: User Story 1 - Stable idempotency key for a step (Priority: P1) 🎯 MVP

**Goal**: Deterministic, escaped, bounded keys.

**Independent Test**: Same inputs across 1,000 simulated restarts → identical key; different workflows → different keys.

- [X] T003 [P] [US1] Write failing key tests (format, escaping `%`/`:`, iteration, namespace "1–64", parts, empty workflowId/step → ConfigError, > 255 → prefix + hash) in packages/core/test/idempotency/key.test.ts
- [X] T004 [P] [US1] Write failing property tests (stability, injectivity on escaped components, length ≤ 255) in packages/core/test/idempotency/key.property.test.ts
- [X] T005 [US1] Implement `idempotencyKey` in packages/core/src/idempotency/key.ts

---

## Phase 4: User Story 2 - Fix hints in reports (Priority: P1)

**Goal**: Every non-passing outcome gets ≥ 1 hint.

**Independent Test**: Duplicated without key → `add-idempotency-key`; concurrent-duplicate with delay fault → `timeout-retry-concurrency`.

- [X] T006 [P] [US2] Write failing catalog tests, one per rule (matches + rendered example) in packages/core/test/hints/catalog.test.ts
- [X] T007 [P] [US2] Write failing attach tests (fallback `investigate`, passing outcomes get no hints, invariant property) in packages/core/test/hints/attach.test.ts
- [X] T008 [US2] Implement hint catalog (add-idempotency-key, provider-ignores-key, timeout-retry-concurrency, orphan-compensate, crash-loop-retries, skipped-ephemeral, allow-by-policy, investigate) in packages/core/src/hints/catalog.ts
- [X] T009 [US2] Implement `attachHints` and call it at the end of `classify()` in packages/core/src/hints/attach.ts and packages/core/src/classifier/classify.ts
- [X] T010 [US2] Write end-to-end fix test: H1 scenario fails without key, passes with `idempotencyKey` in packages/adapter-workflows/test/fix-with-key.e2e.test.ts

---

## Phase 5: User Story 3 - Detect unstable keys (Priority: P2)

**Goal**: Flag differing keys for one identity.

**Independent Test**: Key from `Date.now()` → `unstable-idempotency-key` hint.

- [X] T011 [P] [US3] Write failing unstable-key rule tests in packages/core/test/hints/unstable-key.test.ts
- [X] T012 [US3] Implement `unstable-idempotency-key` rule in packages/core/src/hints/catalog.ts

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 [P] Guide "Fixing duplicate side effects" in docs/guides/fixing-duplicates.md
- [X] T014 Author diagrams covering T001–T015 in specs/011-idempotency-helper/diagram.yaml
- [X] T015 Validate quickstart scenarios in specs/011-idempotency-helper/quickstart.md

## Dependencies & Execution Order

- Requires 007 (Evidence, classify). US1 independent of classifier; US2/US3 after 007.

## Parallel Example

```bash
Task: "T003 key tests"  Task: "T004 key properties"  Task: "T006 catalog tests"
```

## Implementation Strategy

MVP = US1 + US2.
