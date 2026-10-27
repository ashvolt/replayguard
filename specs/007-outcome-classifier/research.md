# Research: Outcome Classifier

## R1 — Evidence per logical identity

For each identity in a case: `attempts`, `applied` (status applied), `deduplicated`, `failed`,
`overlaps` (pairs of applied/dedup attempts whose `[startedAt, settledAt ?? +∞)` intersect with
positive length), `expected` (baseline applied+dedup count; 0 if absent), `workflowState`
(final run outcome state or `unsettled`), `faults` (fault events in the case), `keys`
(distinct idempotency keys), `unsettledAttempts` (still `started` at finalize).

## R2 — Rule order (severity, first match wins)

1. `concurrent-duplicate`: applied ≥ 2 and ∃ overlapping applied pair.
2. `duplicated`: applied > max(expected, 1).
3. `orphaned`: applied ≥ 1 and workflowState = `failed`.
4. `skipped`: expected ≥ 1 and applied + deduplicated = 0 and workflowState = `completed`.
5. `deduplicated`: deduplicated ≥ 1 and applied ≤ max(expected, 1).
6. `exactly-once`: otherwise.

Severity order equals rule order (spec edge case). Identities with expected = 0 and no attempts
are not classified.

## R3 — Expected counts

`expected = applied + deduplicated` in the baseline per identity. Baseline anomalies (overlaps or
dedups in baseline) are reported in `baselineAnomalies`, not failures.

## R4 — Policy

- Default: `{ "exactly-once": pass, deduplicated: pass, duplicated: fail,
  "concurrent-duplicate": fail, orphaned: fail, skipped: fail }`.
- Overrides: `{ kinds?: Record<kind, Partial<Map>>, identities?: Record<identity, Partial<Map>> }`.
- Resolver chain: identity → kind → default.

## R5 — Explanations

Template per outcome with evidence placeholders, e.g. duplicated:
"`payment` applied 2× (expected 1). Fault F1 (crash after payment#1) stopped run 0 before the step
result was saved; run 1 re-executed the step." Generated deterministically.
