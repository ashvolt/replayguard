# Implementation Plan: Task Export to Issue Trackers

**Branch**: `002-task-export` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-task-export/spec.md`

## Summary

A private tool (`tools/export`) parses every `specs/*/spec.md` and `tasks.md` into one
tracker-neutral `Backlog` (Epic → Story → Sub-task, Epic → Task), then renders four outputs into
`exports/`: Jira CSV, Jira REST JSON, GitHub Issues plan, generic CSV. Two importers (Jira REST,
GitHub via `gh`) default to dry-run, are idempotent through a local state file, and read
credentials only from environment variables.

## Technical Context

**Language/Version**: TypeScript ~6.0 via Node native type stripping

**Primary Dependencies**: none at runtime (hand-written RFC 4180 CSV writer; global `fetch` for
Jira; `gh` CLI via `child_process.execFile` without shell)

**Storage**: `exports/*.csv|json` (committed), `.export-state/*.json` (git-ignored)

**Testing**: Vitest golden files; fast-check property tests (CSV round-trip, every task exported
exactly once); importer tests with injected HTTP/`gh` executors

**Target Platform**: Developer machines, GitHub Actions (export freshness check)

**Project Type**: Internal CLI tool

**Performance Goals**: < 5 s for all features (SC-004)

**Constraints**: Deterministic output; network only with `--apply`; never log secrets

**Scale/Scope**: 13 features, ~600 tasks

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | Secrets only from env, redacted in errors; `execFile` without shell; dry-run default | PASS |
| II Test-first | Parsers/renderers test-first with fixtures; property tests | PASS |
| III Modularity | Parser, model, renderers, importers are separate modules | PASS |
| IV Patterns | Recorded below | PASS |
| V Public API | N/A | PASS |
| VI Types | Strict, no `any` | PASS |
| VII Traceability | Implements the export gate | PASS |
| VIII Docs | README with import guides per tracker | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Four output formats from one backlog | **Strategy** (`BacklogRenderer` per format, registry by name) | Format switches spread through code |
| Jira and GitHub creation share ordering, idempotency, dry-run | **Template Method** (`Importer.run`: plan → filter existing → execute in parent-first order → persist state) | Duplicate loops per tracker |
| Network/process side effects in importers | **Ports & Adapters** (`HttpPort`, `CommandPort`) | Direct `fetch`/`execFile` — untestable |

## Project Structure

```text
tools/export/
├── package.json
├── src/
│   ├── cli.ts                # export | import-jira | import-github
│   ├── parse/spec.ts         # stories + priorities
│   ├── parse/tasks.ts        # checklist lines, phases
│   ├── model.ts              # BacklogItem, Backlog builder
│   ├── render/csv.ts         # RFC 4180 writer
│   ├── render/jira-csv.ts
│   ├── render/jira-json.ts
│   ├── render/github.ts
│   ├── render/generic-csv.ts
│   ├── import/importer.ts    # template method
│   ├── import/jira.ts
│   ├── import/github.ts
│   └── import/state.ts
└── test/ (one test file per module + fixtures/)
exports/
├── jira.csv
├── jira.json
├── github-issues.json
└── backlog.csv
```

**Structure Decision**: Private tool package `tools/export`; outputs committed under `exports/`
and verified fresh in CI via `pnpm export:check`.

## Complexity Tracking

No violations.
