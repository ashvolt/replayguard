# Implementation Plan: Reports (Structured, Console, HTML Timeline)

**Branch**: `009-reporters` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-reporters/spec.md`

## Summary

Core gains a versioned `Report` model (`buildReport(classified)`), JSON (de)serialization with
schema validation, and a `ReportVisitor` traversal. `@replayguard/reporter-console` renders tables
(concise/verbose, `NO_COLOR`). `@replayguard/reporter-html` renders one self-contained HTML file:
inline CSS, server-side inline-SVG timelines per case, data in a non-executable JSON block, a tiny
filter script, and a CSP whose script/style hashes are computed at render time.

## Technical Context

**Language/Version**: TypeScript ~6.0

**Primary Dependencies**: core: `valibot` (report schema); reporters: `@replayguard/core` only

**Storage**: Optional `writeReport(path)` helpers in reporter packages (use `node:fs/promises`)

**Testing**: Vitest golden snapshots; XSS injection corpus tests (labels with `<script>`, quotes,
`</script>`, `javascript:`); JSON round-trip property test; HTML size test (100 cases < 1 MB)

**Target Platform**: Node ≥ 22 for writing; HTML for evergreen browsers

**Project Type**: Library packages

**Performance Goals**: render 100 cases < 200 ms; HTML < 1 MB (SC-002)

**Constraints**: zero external references; CSP `default-src 'none'`; no inline event handlers

**Scale/Scope**: ≤ 500 cases

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | Escaping everywhere, CSP with hashes, JSON data block escaped (`<` → `<`) | PASS |
| II Test-first | Golden + injection tests | PASS |
| III Modularity | Reporters depend only on core; model in core | PASS |
| IV Patterns | Visitor recorded below | PASS |
| VI Types | Report schema-inferred types | PASS |
| VII Traceability | diagram.yaml + tasks | PASS |
| VIII Docs | Reporter docs with screenshots | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Multiple formats over one report structure | **Visitor** (`ReportVisitor` + `walkReport`) | Each reporter re-implementing traversal and ordering |
| Report must not depend on reporters | **Ports & Adapters** (reporters as adapters of `Reporter` port) | Core importing reporters |
| Safe HTML generation | **Template with context-aware escaping** (`html` tagged template that escapes all interpolations; `raw()` only for trusted constants) | String concatenation — easy XSS |

## Project Structure

```text
packages/core/src/report/
├── model.ts      # Report, CaseReport, EffectReport, TimelineEvent (schema + types)
├── build.ts      # buildReport(classified)
├── json.ts       # toJSON / parseReport (version check)
└── visitor.ts    # ReportVisitor, walkReport, Reporter port
packages/reporter-console/src/
├── table.ts      # column layout, truncation
├── color.ts      # ANSI with NO_COLOR/FORCE_COLOR handling
└── index.ts      # consoleReporter({ verbose, color }), renderConsole(report)
packages/reporter-html/src/
├── html.ts       # escaping tagged template
├── timeline.ts   # inline SVG timeline per case
├── assets.ts     # CSS + filter script constants
├── csp.ts        # sha256 hashes via globalThis.crypto.subtle
└── index.ts      # renderHtml(report), writeHtmlReport(report, path)
```

**Structure Decision**: Model in core; two reporter packages.

## Complexity Tracking

No violations.
