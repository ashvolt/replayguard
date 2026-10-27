# Research: Idempotency Helper & Hints

## R1 — Key format

- **Decision**: `[namespace:]workflowId:step[:iteration][:extra...]`, each component escaped by
  replacing `%` → `%25` and `:` → `%3A`. If length > 255: `prefix(200) + ":h" + fnv64(full)`.
- **Rationale**: Readable in provider dashboards, unambiguous, provider-limit safe.
- **Why not attempt numbers**: Spike H2 — attempts reset after crashes; keys must survive.

## R2 — Hint catalog

| ID | Outcomes | Matches when | Suggestion |
|---|---|---|---|
| `add-idempotency-key` | duplicated | no keys recorded | pass `idempotencyKey(ctx, step)` to provider |
| `provider-ignores-key` | duplicated | one stable key recorded, no dedup | verify provider dedup support / config |
| `unstable-idempotency-key` | duplicated, concurrent-duplicate | > 1 distinct key for identity | remove time/random/attempt from key |
| `timeout-retry-concurrency` | concurrent-duplicate | delay fault in case | key + cancellation via abort signal; avoid `retryOnTimeout` without key |
| `orphan-compensate` | orphaned | workflow failed | rollback/compensation step or retryable step with key |
| `crash-loop-retries` | duplicated | applied > 3 and crash faults ≥ 2 | crash loops bypass `maxRetries` (H2); keys are mandatory |
| `skipped-ephemeral` | skipped | — | check ephemeral steps / swallowed errors |
| `allow-by-policy` | any failing | kind is notification-like (`email`, `webhook`) | consider policy override if duplicates are acceptable |

## R3 — Code examples

Each hint carries a short TS snippet using public APIs only (`ctx.step`, `idempotencyKey`).
