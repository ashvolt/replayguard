# Implementation Plan: Diagrams-as-Code with Task Traceability

**Branch**: `001-diagrams-as-code` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-diagrams-as-code/spec.md`

## Summary

A private workspace tool (`tools/diagrams`) reads `specs/*/diagram.yaml` (and
`docs/architecture/diagram.yaml`), validates it with Valibot, lays out `flow` diagrams with a
deterministic layered algorithm and `workflow` diagrams as sequence lifelines, and emits
`.excalidraw` scenes plus static SVGs from the same geometry. A `check` command proves every
`T###` in `tasks.md` is drawn and outputs are fresh; `coverage` writes `TRACEABILITY.md`.

## Technical Context

**Language/Version**: TypeScript ~6.0 executed by Node ≥22 native type stripping (erasable syntax only)

**Primary Dependencies**: `yaml` (parse), `valibot` (schema); no rendering libraries

**Storage**: Files in repo (`diagram.yaml` in, `diagrams/*.excalidraw|svg`, `TRACEABILITY.md` out)

**Testing**: Vitest (unit + golden-file), fast-check (layout invariants: no overlapping nodes, determinism)

**Target Platform**: Developer machines (Win/macOS/Linux) and GitHub Actions

**Project Type**: Internal CLI tool in the monorepo

**Performance Goals**: All 13 features regenerate in < 10 s (SC-003)

**Constraints**: Deterministic byte-identical output; no network; SVG without scripts/external refs

**Scale/Scope**: ~14 YAML sources × 4 diagrams, ≤ 40 nodes per diagram

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I Security | No network, SVG escaped and script-free, YAML parsed without custom tags | PASS |
| II Test-first | Golden files + property tests for layout; coverage ≥90% | PASS |
| III Modularity | Tool is private, outside published packages; no package imports it | PASS |
| IV Patterns | Strategy for layouts, Visitor-like renderers — recorded below | PASS |
| V Public API | N/A (no Rivet usage) | PASS |
| VI Types | Strict TS, Valibot-inferred types, no `any` | PASS |
| VII Traceability | This feature implements the gate | PASS |
| VIII Docs | README for YAML format + CLI | PASS |

Post-design re-check: PASS (no violations; Complexity Tracking empty).

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Two layout algorithms (flow, sequence) selected by YAML | **Strategy** (`LayoutStrategy`) | `if/else` in renderer — mixes layout with output |
| Two output formats from one geometry | **Visitor** over `LaidOutDiagram` (`ExcalidrawRenderer`, `SvgRenderer`) | Rendering inside layout — duplicates geometry logic |
| Stable IDs/seeds for Excalidraw elements | **Factory** (`ElementFactory` seeded by feature/diagram/node id) | Random IDs — breaks determinism |

## Project Structure

### Documentation (this feature)

```text
specs/001-diagrams-as-code/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── diagram-yaml.md
│   └── cli.md
├── diagram.yaml
├── diagrams/            # generated
└── tasks.md
```

### Source Code (repository root)

```text
tools/diagrams/
├── package.json             # private, bin: rg-diagrams
├── src/
│   ├── cli.ts               # generate | check | coverage
│   ├── schema.ts            # Valibot schema + inferred types
│   ├── load.ts              # discover + parse sources
│   ├── text.ts              # label wrapping / measurement
│   ├── ids.ts               # deterministic id + seed factory
│   ├── layout/
│   │   ├── types.ts
│   │   ├── flow.ts          # layered layout (ranks, cycle breaking)
│   │   └── sequence.ts      # lifelines + messages
│   ├── render/
│   │   ├── excalidraw.ts
│   │   └── svg.ts
│   └── trace.ts             # tasks.md parsing, coverage, staleness
└── test/
    ├── schema.test.ts
    ├── flow.test.ts
    ├── sequence.test.ts
    ├── excalidraw.test.ts
    ├── svg.test.ts
    ├── trace.test.ts
    ├── cli.test.ts
    └── fixtures/
```

**Structure Decision**: Single private tool package under `tools/diagrams`, consumed via
root scripts `pnpm diagrams:generate` and `pnpm diagrams:check`.

## Complexity Tracking

No violations.
