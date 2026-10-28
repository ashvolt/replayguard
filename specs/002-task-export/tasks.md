---

description: "Task list for 002-task-export"
---

# Tasks: Task Export to Issue Trackers

**Input**: Design documents from `/specs/002-task-export/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (test-first).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create private tool package `@replayguard-tools/export` with bin `rg-export` in tools/export/package.json
- [X] T002 [P] Add tsconfig (erasable syntax, `.ts` imports) in tools/export/tsconfig.json
- [X] T003 [P] Add Vitest config with 90/90 thresholds in tools/export/vitest.config.ts
- [X] T004 [P] Add root scripts `export:generate`, `export:check`, `export:import-jira`, `export:import-github` in package.json; add `.export-state/` to .gitignore

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T005 [P] Write failing spec parser tests (feature title, `### User Story N - Title (Priority: PN)`) in tools/export/test/parse-spec.test.ts
- [X] T006 [P] Write failing tasks parser tests (checklist regex, `[P]`, `[USn]`, `[x]` done, phase detection, malformed line error with file:line) in tools/export/test/parse-tasks.test.ts
- [X] T007 Implement spec parser in tools/export/src/parse/spec.ts
- [X] T008 Implement tasks parser in tools/export/src/parse/tasks.ts
- [X] T009 Write failing tests then implement Backlog builder (source IDs, types, parent order, labels, priority P1→High/P2→Medium/P3+→Low, title ≤ 255 chars, description ends with "Source: specs/<feature>/<file>:<line>") in tools/export/src/model.ts and tools/export/test/model.test.ts
- [X] T010 [P] Write failing tests then implement RFC 4180 CSV writer (CRLF, quoting, UTF-8) incl. fast-check round-trip in tools/export/src/render/csv.ts and tools/export/test/csv.test.ts

**Checkpoint**: Backlog model built from all specs.

---

## Phase 3: User Story 1 - Import backlog into Jira via CSV (Priority: P1) 🎯 MVP

**Goal**: `exports/jira.csv` importable with Epic → Story → Sub-task links.

**Independent Test**: Fixture feature (3 stories, 30 tasks) → 1 Epic, 3 Stories, 24 Sub-tasks, 6 Tasks with correct parents.

- [X] T011 [P] [US1] Write failing Jira CSV golden test in tools/export/test/jira-csv.test.ts
- [X] T012 [US1] Implement Jira CSV renderer (Issue Id, Parent Id, Issue Type, Summary, Description, Priority, Status, repeated Labels) in tools/export/src/render/jira-csv.ts
- [X] T013 [US1] Implement `generate` and `check` commands writing/validating exports/ in tools/export/src/cli.ts with tests in tools/export/test/cli.test.ts
- [X] T014 [US1] Add property test: every task in every tasks.md appears exactly once per format in tools/export/test/completeness.property.test.ts

---

## Phase 4: User Story 2 - Create issues through Jira REST (Priority: P2)

**Goal**: Dry-run-by-default idempotent importer.

**Independent Test**: Dry run prints ordered creates with zero HTTP calls; apply with fake HTTP port creates parents first; re-run creates nothing.

- [X] T015 [P] [US2] Write failing Jira JSON renderer golden test in tools/export/test/jira-json.test.ts
- [X] T016 [P] [US2] Write failing importer template tests (plan, skip existing, parent-first, state persistence, retry 429/5xx, stop on 4xx, secrets never logged) in tools/export/test/importer.test.ts
- [X] T017 [US2] Implement Jira JSON renderer in tools/export/src/render/jira-json.ts
- [X] T018 [US2] Implement Importer template method and ImportState in tools/export/src/import/importer.ts and tools/export/src/import/state.ts
- [X] T019 [US2] Implement Jira importer over `HttpPort` (env `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`) in tools/export/src/import/jira.ts
- [X] T020 [US2] Wire `import-jira [--apply] [--include-done]` in tools/export/src/cli.ts

---

## Phase 5: User Story 3 - Create GitHub Issues (Priority: P2)

**Goal**: Milestones per feature, issues with source markers, dry-run default.

**Independent Test**: Dry run prints `gh` operations; fake `CommandPort` apply skips issues with existing markers.

- [X] T021 [P] [US3] Write failing GitHub plan renderer + importer tests in tools/export/test/github.test.ts
- [X] T022 [US3] Implement GitHub issues plan renderer in tools/export/src/render/github.ts
- [X] T023 [US3] Implement GitHub importer via `CommandPort` (`execFile("gh", args)`, no shell) in tools/export/src/import/github.ts
- [X] T024 [US3] Wire `import-github [--apply] [--repo]` in tools/export/src/cli.ts

---

## Phase 6: User Story 4 - Generic CSV (Priority: P3)

**Goal**: Flat CSV for Linear/Azure Boards.

**Independent Test**: Every non-Epic row's `parent_id` exists in file.

- [X] T025 [P] [US4] Write failing generic CSV test in tools/export/test/generic-csv.test.ts
- [X] T026 [US4] Implement generic CSV renderer in tools/export/src/render/generic-csv.ts

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T027 [P] Write import guides per tracker in tools/export/README.md
- [X] T028 [P] Add performance test (< 5 s for all features) in tools/export/test/perf.test.ts
- [X] T029 Author diagrams covering T001–T030 in specs/002-task-export/diagram.yaml
- [X] T030 Generate exports/ for all features and validate quickstart in specs/002-task-export/quickstart.md

## Dependencies & Execution Order

- Setup → Foundational (T005–T010) → US1 → US2/US3 (parallel) → US4 → Polish.
- T018 (template) precedes T019 and T023.

## Parallel Example

```bash
Task: "T015 Jira JSON tests"  Task: "T016 importer tests"  Task: "T021 GitHub tests"  Task: "T025 generic CSV test"
```

## Implementation Strategy

MVP = Jira CSV (US1). REST/GitHub importers add automation; generic CSV adds breadth.
