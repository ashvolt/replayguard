# Data Model: Outcome Classifier

## Outcome

`"exactly-once" | "deduplicated" | "duplicated" | "concurrent-duplicate" | "orphaned" | "skipped"`

## VerdictLevel: `"pass" | "warn" | "fail"`

## Evidence

| Field | Type |
|---|---|
| `identity`, `kind`, `subject` | string |
| `attemptSeqs` | number[] |
| `applied`, `deduplicated`, `failed`, `expected` | number |
| `overlaps` | `[number, number][]` (attempt seq pairs) |
| `keys` | string[] |
| `unsettled` | number[] |
| `workflowState` | `"completed" \| "failed" \| "waiting" \| "unsettled"` |
| `faultIds` | string[] |

## EffectClassification

`{ identity, kind, subject, outcome: Outcome, verdict: VerdictLevel, evidence: Evidence,
explanation: string, hints: FixHint[] }` (`hints` filled by feature 011; empty array until then)

## CaseClassification

`{ caseIndex, name, effects: EffectClassification[], verdict: VerdictLevel,
warnings: string[] }` — verdict = worst effect verdict; `harness-error` cases → `fail`.

## ClassifiedResult

`{ version: 1, result: ScenarioResult, cases: CaseClassification[],
verdict: VerdictLevel, baselineAnomalies: string[], policy: Policy }`

## Policy

`{ default?: Partial<Record<Outcome, VerdictLevel>>, kinds?: Record<string,
Partial<Record<Outcome, VerdictLevel>>>, identities?: Record<string, Partial<Record<Outcome,
VerdictLevel>>> }`
