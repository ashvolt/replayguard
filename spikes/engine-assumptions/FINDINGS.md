# Spike F0: Engine Side-Effect Assumptions

**Target:** `@rivet-dev/workflows@1.0.0` (engine level, `InMemoryDriver`, yield mode)
**Date:** 2026-10-27
**Run:** `pnpm spike`. All 9 tests pass, and each one asserts that its hypothesis is true.

## Crash model

`CrashableDriver` extends the public `InMemoryDriver`. When a step calls `crash()`, every later
persistence write throws, which models the host process dying. A restart is a new `runWorkflow` call
on the same durable KV. No engine internals are patched.

## Results

| ID | Hypothesis | Result | Impact |
|----|-----------|--------|--------|
| H0 | A step that throws after an external call re-runs the call on retry | Confirmed (2 charges) | Documented at-least-once behavior; baseline |
| H1 | A crash after the external call but before the step result is flushed re-runs the step on restart | **Confirmed (2 charges)** | Core ReplayGuard scenario |
| H1b | A provider-side idempotency key (`workflowId:stepName`) turns the duplicate into a dedup | Confirmed (2 attempts, 1 applied) | The mitigation works; the key must be stable across restarts |
| H2 | The attempt counter is not persisted before `run()`, so crash loops bypass `maxRetries` | **Confirmed (6 charges with maxRetries=2, no `StepExhaustedError`)** | Unbounded duplicates; possible upstream issue |
| H2-diag | The durable store holds no step entry after a crash inside a step | Confirmed (0 entries) | The engine cannot tell that the step ever started |
| H3a | `retryOnTimeout`: the timed-out call keeps running and completes alongside the retry | **Confirmed (2 charges)** | Concurrent duplicate, even without a crash |
| H3b | Default (critical) timeout: the workflow fails but the charge still lands | **Confirmed** | Orphaned effect: money taken, workflow says failed |
| H4 | The result of an `ephemeral` step is lost when a later step crashes | Confirmed (email sent twice; control sent once) | Ephemeral steps widen the duplicate window |

## Consequences for specs

1. **Outcome taxonomy for F4:**
   - `exactly-once`
   - `duplicated`
   - `deduplicated` (attempted more than once, applied once)
   - `orphaned` (applied, but the workflow failed or never recorded it)
   - `concurrent-duplicate` (overlapping in-flight calls caused by timeouts)
   - `skipped`
2. **Fault points for F1:** after the effect and before the flush; inside the effect; while a timeout
   is in flight; before an ephemeral step's batch is persisted.
3. **The F7 helper must provide** a key that stays the same across crashes (`workflowId` + step
   name + loop iteration). It must not depend on the attempt number, because H2 shows the attempt
   counter resets after a crash.
4. **F10 upstream candidates:**
   - (a) flush attempt metadata before `run()`, or expose a "started" marker;
   - (b) give the step callback an `AbortSignal` that fires on step timeout;
   - (c) expose a stable step ID or idempotency key to the step callback.
