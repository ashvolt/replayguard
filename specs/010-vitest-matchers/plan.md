# Implementation Plan: Vitest Matchers

**Branch**: `010-vitest-matchers` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-vitest-matchers/spec.md`

## Summary

`@replayguard/vitest` exports matcher implementations and a `setup` entry
(`import "@replayguard/vitest/setup"`) calling `expect.extend`, plus a `.d.ts` augmenting
Vitest's `Assertion` interfaces. Matchers accept `ClassifiedResult` or `Report` (normalized via
core), compute violations, and format messages listing case/effect/outcome/explanation.

## Technical Context

**Language/Version**: TypeScript ~6.0

**Primary Dependencies**: `@replayguard/core`; peer `vitest >=4 <6`

**Storage**: N/A

**Testing**: Vitest (matchers testing themselves via `expect(...).toPass...` and
`expect(() => ...).toThrow(message)`); type tests with `expectTypeOf` / `@ts-expect-error`

**Target Platform**: Node ≥ 22

**Project Type**: Library package

**Performance Goals**: N/A

**Constraints**: Must not import reporters (FR-006)

**Scale/Scope**: 5 matchers

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | Pure | PASS |
| II Test-first | Positive/negative/negated tests per matcher + type tests | PASS |
| III Modularity | core + peer vitest only | PASS |
| IV Patterns | Adapter recorded below | PASS |
| VI Types | Module augmentation, typed selectors/outcomes | PASS |
| VII Traceability | diagram.yaml + tasks | PASS |
| VIII Docs | Matcher reference | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Accept both `ClassifiedResult` and `Report` | **Adapter** (`toReport(input)`) | Duplicate matcher logic per input type |
| Shared violation formatting | **Template Method** (`createMatcher(predicate, describe)`) | Per-matcher message code |

## Project Structure

```text
packages/vitest/src/
├── normalize.ts     # ClassifiedResult | Report → Report
├── violations.ts    # selectors, violation collection, message formatting (first 20 + count)
├── matchers.ts      # five matchers
├── setup.ts         # expect.extend(matchers)
├── types.d.ts       # module augmentation for vitest Assertion/AsymmetricMatchersContaining
└── index.ts
packages/vitest/test/
├── matchers.test.ts  violations.test.ts  normalize.test.ts  types.test-d.ts
```

**Structure Decision**: Separate package with `./setup` subpath export.

## Complexity Tracking

No violations.
