# Data Model: Idempotency Helper & Hints

## IdempotencyKeyOptions

`{ iteration?: number (integer ≥ 0), namespace?: string (1–64), parts?: (string | number)[] }`

## FixHint

`{ id: string, title: string (≤ 80), explanation: string, example: string }`

## HintRule

`{ id, outcomes: Outcome[], matches(evidence: Evidence, context: HintContext): boolean,
render(evidence, context): FixHint }`

## HintContext

`{ faults: FaultSpec[], faultOutcomes: FaultOutcome[], finalState, kind }`

Invariant: every `EffectClassification` with verdict ≠ `pass` has `hints.length ≥ 1`
(fallback hint `investigate` when no rule matches).
