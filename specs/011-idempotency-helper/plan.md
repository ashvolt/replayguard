# Implementation Plan: Idempotency Key Helper & Fix Hints

**Branch**: `011-idempotency-helper` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-idempotency-helper/spec.md`

## Summary

Core adds `idempotencyKey(ctx, step, options?)` — deterministic, escaped, ≤ 255 chars, derived
only from workflow ID, step, iteration, namespace and extra parts — and a data-driven hint engine:
a catalog of `HintRule`s evaluated against classifier evidence + case faults, attached to every
non-passing `EffectClassification`. Includes detection of unstable keys (multiple distinct keys
for one identity).

## Technical Context

**Language/Version**: TypeScript ~6.0

**Primary Dependencies**: core internals (`canonicalHash`)

**Storage**: N/A

**Testing**: Vitest; fast-check (stability over 1,000 restarts, injectivity on escaped parts,
length bound); end-to-end: spike H1 scenario fails without key, passes with key (SC-001)

**Target Platform**: any JS runtime

**Project Type**: Library module in core

**Performance Goals**: N/A

**Constraints**: Keys never include time/random/attempt; hints deterministic

**Scale/Scope**: ~8 hint rules

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | Keys contain no secrets beyond what user passes; hashing for length only | PASS |
| II Test-first | Property + e2e tests | PASS |
| III Modularity | core `idempotency/`, `hints/` | PASS |
| IV Patterns | Rule catalog (Specification) recorded below | PASS |
| VI Types | Structural `{ workflowId: string }` context type | PASS |
| VII Traceability | diagram.yaml + tasks | PASS |
| VIII Docs | Guide "Fixing duplicate side effects" | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Many independent "if this evidence then suggest that" rules | **Specification / rule catalog** (`HintRule { id, outcomes, matches(evidence, ctx), render() }`) | Hard-coded switch in classifier |
| Hints must enrich classification without coupling | **Decorator** of classification step (`attachHints(classified)`) | Classifier computing hints inline |

## Project Structure

```text
packages/core/src/
├── idempotency/key.ts      # idempotencyKey()
└── hints/
    ├── types.ts            # FixHint, HintRule
    ├── catalog.ts          # rule definitions
    └── attach.ts           # attachHints(classified)
packages/core/test/
├── idempotency/key.test.ts  key.property.test.ts
└── hints/catalog.test.ts  attach.test.ts  e2e-fix.test.ts (adapter-workflows dev dep)
```

**Structure Decision**: Core modules; `classify()` calls `attachHints` as its final step.

## Complexity Tracking

No violations.
