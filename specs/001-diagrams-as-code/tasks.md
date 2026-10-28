---

description: "Task list for 001-diagrams-as-code"
---

# Tasks: Diagrams-as-Code with Task Traceability

**Input**: Design documents from `/specs/001-diagrams-as-code/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (constitution Principle II — test-first). Test tasks precede implementation.

**Organization**: Grouped by user story.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create private tool package `@replayguard-tools/diagrams` with bin `rg-diagrams`, deps `yaml` and `valibot`, scripts `test`/`check-types` in tools/diagrams/package.json
- [X] T002 [P] Add tsconfig with `erasableSyntaxOnly`, `allowImportingTsExtensions`, `noEmit` in tools/diagrams/tsconfig.json
- [X] T003 [P] Add Vitest config with coverage thresholds 90/90 in tools/diagrams/vitest.config.ts
- [X] T004 [P] Add root scripts `diagrams:generate`, `diagrams:check`, `diagrams:coverage` (node --experimental-strip-types) in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T005 [P] Write failing schema tests (valid source, duplicate node ids, unknown edge refs, `sequence` only for `workflow`, task id pattern, keyPath error messages) in tools/diagrams/test/schema.test.ts
- [X] T006 Implement Valibot schema with constraints from data-model.md ("1–40 nodes", "label 1–80 chars", "tasks match ^T\d{3,}$") and cross-reference validation in tools/diagrams/src/schema.ts
- [X] T007 [P] Write failing tests then implement deterministic id/seed factory (hash of feature/kind/element id) in tools/diagrams/src/ids.ts and tools/diagrams/test/ids.test.ts
- [X] T008 [P] Write failing tests then implement label wrapping/measurement (max width 220 px, line height 1.25) in tools/diagrams/src/text.ts and tools/diagrams/test/text.test.ts
- [X] T009 Write failing tests then implement source discovery (`specs/*/diagram.yaml`, `docs/architecture/diagram.yaml`, repo root detection) in tools/diagrams/src/load.ts and tools/diagrams/test/load.test.ts

**Checkpoint**: Sources load and validate.

---

## Phase 3: User Story 1 - Generate editable diagrams (Priority: P1) 🎯 MVP

**Goal**: YAML → `.excalidraw` + `.svg` for flow and sequence diagrams, deterministic.

**Independent Test**: Two-node YAML generates files that open in Excalidraw; second run yields no diff.

### Tests for User Story 1

- [X] T010 [P] [US1] Write failing flow layout tests incl. fast-check properties (no node overlap, determinism, cycle termination) in tools/diagrams/test/flow.test.ts
- [X] T011 [P] [US1] Write failing sequence layout tests (actor order, message order, self-message loop, dashed replies) in tools/diagrams/test/sequence.test.ts
- [X] T012 [P] [US1] Write failing Excalidraw renderer tests (scene v2 shape, bound text `containerId`, arrow bindings, `boundElements`, task badges) in tools/diagrams/test/excalidraw.test.ts
- [X] T013 [P] [US1] Write failing SVG renderer tests (escaping of `<&"`, no `<script>`/external refs, task badges, dark-safe colors) in tools/diagrams/test/svg.test.ts

### Implementation for User Story 1

- [X] T014 [US1] Implement layered flow layout (cycle breaking, longest-path ranks, barycenter ordering, group frames) in tools/diagrams/src/layout/flow.ts
- [X] T015 [US1] Implement sequence layout in tools/diagrams/src/layout/sequence.ts
- [X] T016 [US1] Implement Excalidraw scene renderer from `LaidOutDiagram` in tools/diagrams/src/render/excalidraw.ts
- [X] T017 [US1] Implement SVG renderer from `LaidOutDiagram` in tools/diagrams/src/render/svg.ts
- [X] T018 [US1] Implement `generate [--feature]` command writing `diagrams/<kind>.excalidraw|svg` with LF endings in tools/diagrams/src/cli.ts and tools/diagrams/test/cli.test.ts

**Checkpoint**: Diagrams generate deterministically.

---

## Phase 4: User Story 2 - Fail the build when a task is missing (Priority: P1)

**Goal**: `check` enforces task coverage, unknown IDs and freshness.

**Independent Test**: Add `T099` to a fixture `tasks.md` only → `check` exits 1 naming `T099`.

### Tests for User Story 2

- [X] T019 [P] [US2] Write failing traceability tests (task line parsing, untraced, unknown, missing source, spec-only skip) in tools/diagrams/test/trace.test.ts
- [X] T020 [P] [US2] Write failing staleness tests (edited YAML without regeneration → stale files listed) in tools/diagrams/test/stale.test.ts

### Implementation for User Story 2

- [X] T021 [US2] Implement task extraction and coverage comparison in tools/diagrams/src/trace.ts
- [X] T022 [US2] Implement in-memory regeneration and byte comparison in tools/diagrams/src/stale.ts
- [X] T023 [US2] Implement `check [--feature]` command with output format and exit codes from contracts/cli.md in tools/diagrams/src/cli.ts

**Checkpoint**: Traceability gate enforceable.

---

## Phase 5: User Story 3 - See which diagrams cover a task (Priority: P2)

**Goal**: `TRACEABILITY.md` per feature + `coverage` summary.

**Independent Test**: Generate for one feature → table lists every task with kinds and node labels.

- [X] T024 [P] [US3] Write failing tests for traceability table rendering in tools/diagrams/test/coverage.test.ts
- [X] T025 [US3] Implement `TRACEABILITY.md` writer and `coverage` command in tools/diagrams/src/coverage.ts and tools/diagrams/src/cli.ts

---

## Phase 6: User Story 4 - Product-level architecture overview (Priority: P3)

**Goal**: Product HLD + package architecture diagrams under `docs/architecture/`.

**Independent Test**: Generate `docs/architecture/diagrams/*` without task checks.

- [X] T026 [US4] Exempt `architecture` sources from task checks in tools/diagrams/src/trace.ts with test in tools/diagrams/test/trace.test.ts
- [X] T027 [US4] Author product HLD and package-dependency diagrams in docs/architecture/diagram.yaml

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T028 [P] Document YAML format and CLI in tools/diagrams/README.md
- [X] T029 [P] Add performance test (all sources generate in < 10 s) and no-network guard (fetch stubbed to throw) in tools/diagrams/test/perf.test.ts
- [X] T030 Author this feature's diagrams (HLD, LLD, workflow, architecture) covering T001–T031 in specs/001-diagrams-as-code/diagram.yaml
- [X] T031 Generate outputs for all features, validate each `.excalidraw` against the scene structure (SC-004) and verify quickstart scenarios in specs/001-diagrams-as-code/quickstart.md

---

## Dependencies & Execution Order

- Setup (T001–T004) → Foundational (T005–T009) → US1 (T010–T018) → US2 (T019–T023) → US3 (T024–T025) → US4 (T026–T027) → Polish.
- US2 depends on US1 renderers for staleness (T022 uses T016/T017). US3 depends on T021.
- Tests within a story precede implementation and must fail first.

## Parallel Example: User Story 1

```bash
Task: "T010 flow layout tests"   Task: "T011 sequence layout tests"
Task: "T012 excalidraw tests"    Task: "T013 svg tests"
```

## Implementation Strategy

MVP = US1 + US2 (generation + gate). US3/US4 add navigation and onboarding.
