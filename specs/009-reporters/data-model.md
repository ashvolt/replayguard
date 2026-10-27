# Data Model: Report

## Report (version 1)

| Field | Type |
|---|---|
| `version` | `1` |
| `generatedAt` | ISO string (injected clock) |
| `scenario` | `{ name, runtime, workflowId, seed }` |
| `summary` | `{ cases, verdict, outcomes: Record<Outcome, number>, verdicts: Record<VerdictLevel, number>, skippedCandidates }` |
| `baselineAnomalies` | string[] |
| `cases` | CaseReport[] (baseline first) |

## CaseReport

`{ index, name, origin, faults: string[] (human-readable), status, finalState, runs, restarts,
durationMs, verdict, effects: EffectReport[], timeline: TimelineEvent[], warnings: string[] }`

## EffectReport

`{ identity, kind, subject, outcome, verdict, applied, deduplicated, failed, expected,
explanation, hints: { id, title, explanation, example }[] }`

## TimelineEvent (discriminated by `type`)

| type | fields |
|---|---|
| `run` | `runIndex, start, end, endReason` |
| `attempt` | `seq, runIndex, kind, subject, start, end?, status` |
| `fault` | `id, runIndex, at, label` |

All times relative to case start (ms).
