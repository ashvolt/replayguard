---

description: "Task list for 010-vitest-matchers"
---

# Tasks: Vitest Matchers

**Input**: Design documents from `/specs/010-vitest-matchers/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (test-first, type tests).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Configure exports (`.`, `./setup`), core dependency and `vitest >=4 <6` peer in packages/vitest/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T002 [P] Write failing normalize tests (ClassifiedResult → Report, Report passthrough, invalid input message) in packages/vitest/test/normalize.test.ts
- [ ] T003 Implement `toReport` adapter in packages/vitest/src/normalize.ts
- [ ] T004 [P] Write failing violation formatting tests (selector by kind/prefix/predicate, first 20 + "…and N more") in packages/vitest/test/violations.test.ts
- [ ] T005 Implement selectors, violation collection, message formatting in packages/vitest/src/violations.ts

---

## Phase 3: User Story 1 - Assert the policy passes (Priority: P1) 🎯 MVP

**Goal**: `toPassSideEffectPolicy`.

**Independent Test**: Duplicate charge fails with case + effect in message; `.not` works.

- [ ] T006 [P] [US1] Write failing tests for `toPassSideEffectPolicy` (pass, fail, negation, custom policy re-classification) in packages/vitest/test/policy-matcher.test.ts
- [ ] T007 [US1] Implement `toPassSideEffectPolicy` via `createMatcher` template in packages/vitest/src/matchers.ts
- [ ] T008 [US1] Implement `setup.ts` registering matchers with `expect.extend` in packages/vitest/src/setup.ts

---

## Phase 4: User Story 2 - Targeted matchers (Priority: P1)

**Goal**: Duplicate/orphan/once/outcome matchers.

**Independent Test**: Deduplicated payment passes `toBeEffectivelyOnce("payment")`.

- [ ] T009 [P] [US2] Write failing tests for `toHaveNoDuplicateEffects`, `toHaveNoOrphanedEffects`, `toBeEffectivelyOnce`, `toHaveOutcome` in packages/vitest/test/matchers.test.ts
- [ ] T010 [US2] Implement the four matchers in packages/vitest/src/matchers.ts

---

## Phase 5: User Story 3 - Type-safe setup (Priority: P2)

**Goal**: Module augmentation with typed outcomes.

**Independent Test**: Invalid outcome literal is a type error.

- [ ] T011 [P] [US3] Write type tests with `expectTypeOf` and `@ts-expect-error` in packages/vitest/test/types.test-d.ts
- [ ] T012 [US3] Implement Vitest module augmentation in packages/vitest/src/types.d.ts

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T013 [P] CI job testing against previous Vitest major in .github/workflows/ci.yml
- [ ] T014 [P] Matcher reference docs in docs/vitest/README.md
- [ ] T015 Author diagrams covering T001–T016 in specs/010-vitest-matchers/diagram.yaml
- [ ] T016 Validate quickstart scenarios in specs/010-vitest-matchers/quickstart.md

## Dependencies & Execution Order

- Requires 007 (classify) and 009 (Report model). Foundational → US1 → US2 → US3 → Polish.

## Parallel Example

```bash
Task: "T002 normalize tests"  Task: "T004 violations tests"
```

## Implementation Strategy

MVP = US1.
