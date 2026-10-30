---

description: "Task list for 013-upstream-proposal"
---

# Tasks: Upstream Proposal to Rivet

**Input**: Design documents from `/specs/013-upstream-proposal/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Reproductions are tests.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add `upstream/*` to workspace packages in pnpm-workspace.yaml and create upstream/README.md with tracker table

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 Record latest published `@rivet-dev/workflows` version and confirm gaps still reproduce in upstream/README.md

---

## Phase 3: User Story 1 - Minimal reproductions (Priority: P1) 🎯 MVP

**Goal**: Three standalone repros with EXPECT_GAP mode.

**Independent Test**: Each repro fails without EXPECT_GAP and passes with it, < 60 s.

- [X] T003 [P] [US1] Create crash-loop retries repro (H2) in upstream/repro-crash-loop-retries/test/repro.test.ts
- [X] T004 [P] [US1] Create timeout continuation repro (H3) in upstream/repro-timeout-continuation/test/repro.test.ts
- [X] T005 [P] [US1] Create stable step identity repro in upstream/repro-stable-step-identity/test/repro.test.ts
- [X] T006 [US1] Add CI job running repros with `EXPECT_GAP=1` in .github/workflows/ci.yml

---

## Phase 4: User Story 2 - Issue drafts with design proposals (Priority: P1)

**Goal**: Reviewed drafts, not filed.

**Independent Test**: Drafts contain summary, observed, expected, impact, repro, options, environment.

- [X] T007 [P] [US2] Draft crash-loop retries issue in upstream/drafts/01-crash-loop-retries.md
- [X] T008 [P] [US2] Draft timeout continuation issue in upstream/drafts/02-timeout-continuation.md
- [X] T009 [P] [US2] Draft stable step identity issue in upstream/drafts/03-stable-step-identity.md

---

## Phase 5: User Story 3 - Track responses (Priority: P3)

**Goal**: Tracker kept current; filing only after approval.

**Independent Test**: Tracker rows show status and decision.

- [X] T010 [US3] Request maintainer approval, file approved issues, update tracker in upstream/README.md

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T011 Link repro evidence from user docs in docs/faults/strategies.md
- [X] T012 Author diagrams covering T001–T013 in specs/013-upstream-proposal/diagram.yaml
- [X] T013 Validate quickstart in specs/013-upstream-proposal/quickstart.md

## Dependencies & Execution Order

- Independent of product packages (repros use only the engine). T010 requires explicit approval.

## Implementation Strategy

MVP = repros + drafts. Filing is a gated outward action.
