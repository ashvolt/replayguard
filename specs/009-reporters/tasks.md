---

description: "Task list for 009-reporters"
---

# Tasks: Reports (Structured, Console, HTML Timeline)

**Input**: Design documents from `/specs/009-reporters/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (test-first, injection corpus).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create `report/` module and exports in packages/core/src/report/index.ts
- [ ] T002 [P] Add core dependency and exports in packages/reporter-console/package.json and packages/reporter-html/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T003 Define Report v1 Valibot schema and inferred types (Report, CaseReport, EffectReport, TimelineEvent) in packages/core/src/report/model.ts
- [ ] T004 [P] Write failing visitor traversal tests (order: report → cases → effects → timeline) in packages/core/test/report/visitor.test.ts
- [ ] T005 Implement `ReportVisitor`, `walkReport`, `Reporter` port in packages/core/src/report/visitor.ts

---

## Phase 3: User Story 1 - Structured report object (Priority: P1) 🎯 MVP

**Goal**: buildReport + JSON round-trip.

**Independent Test**: `parseReport(reportToJson(r))` deep-equals `r`.

- [ ] T006 [P] [US1] Write failing buildReport tests (summary counts, relative timeline times, fault labels, hints carried) in packages/core/test/report/build.test.ts
- [ ] T007 [P] [US1] Write failing JSON round-trip property test and version rejection (`RG_SCHEMA_VERSION`) in packages/core/test/report/json.test.ts
- [ ] T008 [US1] Implement `buildReport` in packages/core/src/report/build.ts
- [ ] T009 [US1] Implement `reportToJson` and `parseReport` in packages/core/src/report/json.ts

---

## Phase 4: User Story 2 - Console table (Priority: P1)

**Goal**: Compact, colored (optional) table with summary.

**Independent Test**: Duplicated case row shows `duplicated`, `FAIL`, explanation; `NO_COLOR` → no ANSI.

- [ ] T010 [P] [US2] Write failing table layout tests (widths, max 40, truncation `…`, ascii fallback) in packages/reporter-console/test/table.test.ts
- [ ] T011 [P] [US2] Write failing color policy tests (`NO_COLOR`, `FORCE_COLOR`, non-TTY) in packages/reporter-console/test/color.test.ts
- [ ] T012 [P] [US2] Write failing golden output tests (concise vs verbose) in packages/reporter-console/test/render.test.ts
- [ ] T013 [US2] Implement table layout in packages/reporter-console/src/table.ts
- [ ] T014 [US2] Implement color handling in packages/reporter-console/src/color.ts
- [ ] T015 [US2] Implement `renderConsole` and `consoleReporter` as ReportVisitor in packages/reporter-console/src/index.ts

---

## Phase 5: User Story 3 - HTML timeline report (Priority: P2)

**Goal**: Single self-contained, safe, accessible HTML.

**Independent Test**: H3 report shows overlapping payment bars; injection corpus never produces executable markup.

- [ ] T016 [P] [US3] Write failing escaping tests for `html` tagged template (corpus: `<script>`, `</script>`, quotes, `javascript:`, U+2028) in packages/reporter-html/test/html.test.ts
- [ ] T017 [P] [US3] Write failing timeline SVG tests (lanes per run, bar status patterns, fault markers, min width, `<title>` labels) in packages/reporter-html/test/timeline.test.ts
- [ ] T018 [P] [US3] Write failing document tests (no external URLs, CSP meta with matching sha256 hashes, JSON data block escaped, filters keyboard-operable, color-scheme) in packages/reporter-html/test/render.test.ts
- [ ] T019 [US3] Implement escaping template in packages/reporter-html/src/html.ts
- [ ] T020 [US3] Implement timeline renderer in packages/reporter-html/src/timeline.ts
- [ ] T021 [US3] Implement CSS/filter script assets and CSP hashing in packages/reporter-html/src/assets.ts and packages/reporter-html/src/csp.ts
- [ ] T022 [US3] Implement `renderHtml` and `writeHtmlReport` in packages/reporter-html/src/index.ts

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T023 [P] Size/perf test: 100-case HTML < 1 MB, render < 200 ms in packages/reporter-html/test/perf.test.ts
- [ ] T024 [P] Reporter docs with example output in docs/reporters/README.md
- [ ] T025 Author diagrams covering T001–T026 in specs/009-reporters/diagram.yaml
- [ ] T026 Validate quickstart scenarios in specs/009-reporters/quickstart.md

## Dependencies & Execution Order

- Requires 007 (ClassifiedResult) and 011 hints field (optional, empty until 011).
- Foundational → US1 → US2/US3 (parallel) → Polish.

## Parallel Example

```bash
Task: "T010 table tests"  Task: "T016 escaping tests"  Task: "T017 timeline tests"
```

## Implementation Strategy

MVP = US1 + US2. HTML timeline follows.
