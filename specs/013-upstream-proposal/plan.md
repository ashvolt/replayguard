# Implementation Plan: Upstream Proposal to Rivet

**Branch**: `013-upstream-proposal` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-upstream-proposal/spec.md`

## Summary

Create `upstream/` with three standalone reproduction packages (crash-loop retries, timeout
continuation, missing stable step identity), issue drafts with design options, and a tracker.
Nothing is filed without explicit maintainer approval.

## Technical Context

**Language/Version**: TypeScript (repros run with Vitest)

**Primary Dependencies**: published `@rivet-dev/workflows` (latest at drafting), `vitest`

**Storage**: N/A

**Testing**: Each repro's test asserts the *expected* behavior and therefore fails while the gap
exists (green-to-red demonstration); a meta test in CI runs them in "expect gap" mode so our CI
stays green and alerts when upstream fixes land.

**Target Platform**: Node ≥ 22

**Project Type**: Documentation + standalone repro packages (excluded from the workspace publish)

**Performance Goals**: each repro < 60 s from fresh clone (SC-001)

**Constraints**: Repros must not depend on ReplayGuard packages

**Scale/Scope**: 3 repros, 3 drafts

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | Outward-facing filing gated on approval (FR-004) | PASS |
| II Test-first | Repros are tests | PASS |
| V Public API | Repros use public engine API only | PASS |
| VII Traceability | diagram.yaml + tasks | PASS |
| VIII Docs | Evidence linked from docs | PASS |

Post-design re-check: PASS.

## Design Patterns

N/A — documentation and standalone tests; no runtime architecture introduced.

## Project Structure

```text
upstream/
├── README.md                    # index + tracker table
├── repro-crash-loop-retries/    # package.json, test/repro.test.ts, README.md
├── repro-timeout-continuation/
├── repro-stable-step-identity/
└── drafts/
    ├── 01-crash-loop-retries.md
    ├── 02-timeout-continuation.md
    └── 03-stable-step-identity.md
```

**Structure Decision**: `upstream/` outside `packages/`; repros added to the workspace as private
packages (`upstream/*`) so CI can run the "expect gap" mode.

## Complexity Tracking

No violations.
