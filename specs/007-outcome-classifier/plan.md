# Implementation Plan: Outcome Classifier & Verdict Policy

**Branch**: `007-outcome-classifier` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-outcome-classifier/spec.md`

## Summary

A pure `classify(result, policy?)` in core turns a `ScenarioResult` into a `ClassifiedResult`:
expected effects from the baseline, one outcome per logical effect per case decided by ordered
Specification rules, explanations, and pass/warn/fail verdicts at effect, case and scenario level
from a strict default policy with per-kind/per-identity overrides.

## Technical Context

**Language/Version**: TypeScript ~6.0

**Primary Dependencies**: `valibot` (policy validation)

**Storage**: N/A

**Testing**: Vitest table tests (one per spike hypothesis + each edge case); fast-check with a
ledger-snapshot generator proving FR-010 invariants over 10,000 runs; Stryker ≥ 85%

**Target Platform**: any JS runtime

**Project Type**: Library module in core

**Performance Goals**: 100 cases < 100 ms (SC-003)

**Constraints**: Pure function, no clock/IO

**Scale/Scope**: ≤ 500 cases × ≤ 100 identities

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | Pure data transformation | PASS |
| II Test-first | Property tests + 85% mutation gate | PASS |
| III Modularity | `classifier/` depends only on ledger/scenario types | PASS |
| IV Patterns | Specification, Chain (severity order) recorded below | PASS |
| VI Types | Outcome union exhaustively switched (`never` checks) | PASS |
| VII Traceability | diagram.yaml + tasks | PASS |
| VIII Docs | Outcome reference page per class | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Six outcomes with precedence and independent logic | **Specification** (`OutcomeRule { outcome, isSatisfiedBy(evidence) }`) evaluated in severity order | One large if/else function — untestable per rule, mutation-hostile |
| Verdict resolution: identity override → kind override → default | **Chain of Responsibility** (resolver list) | Nested lookups inline |

## Project Structure

```text
packages/core/src/classifier/
├── types.ts          # Outcome, Evidence, EffectClassification, Verdict, ClassifiedResult
├── evidence.ts       # build per-identity evidence from a case + baseline
├── rules.ts          # Specification rules + severity order
├── explain.ts        # explanation templates
├── policy.ts         # Policy schema, default, resolver chain
└── classify.ts       # classify(result, policy)
packages/core/test/classifier/
├── evidence.test.ts  rules.test.ts  explain.test.ts  policy.test.ts
├── classify.spike.test.ts      # H0–H4 expected outcomes
├── classify.property.test.ts   # invariants
└── arbitraries.ts              # fast-check generators for snapshots
```

**Structure Decision**: Module inside core.

## Complexity Tracking

No violations.
