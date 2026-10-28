<!--
DRAFT: not filed. Requires ReplayGuard maintainer approval (spec 013, FR-004).
Title: Step timeout does not cancel the running call; timed-out side effects still land
Repo: rivet-dev/workflows
Labels: enhancement, durability
-->

## Summary

When a step exceeds its `timeout`, the engine stops waiting for it, but the `run()` promise
keeps executing and nothing signals it to stop. `ctx.abortSignal` is not aborted on step
timeout. As a result, a timed-out call still reaches the provider:

- with `retryOnTimeout: true`, the retry calls the provider a second time, so the effect is
  applied twice;
- with the default critical timeout, the workflow fails, but the effect still lands afterwards.
  Nothing records or compensates it.

## Observed

- `retryOnTimeout: true`, a provider that takes 80 ms and `timeout: 20`: **both** calls are
  applied, even though the provider call honors `ctx.abortSignal`.
- Critical `timeout: 20`, a provider that takes 60 ms: the workflow ends in failure, and the
  charge is applied after the failure.

## Expected

A timed-out step attempt is cancelled. The step callback has an `AbortSignal` that is aborted
when its attempt times out, so a cancellation-aware call (`fetch(url, { signal })`) stops and
does not apply its effect.

## Impact

Timeouts are the usual protection against hanging providers, yet here they turn a slow call into
a duplicate (with retry) or an orphaned effect (without retry). The engine's own comment on
`executeWithTimeout` acknowledges that timeouts do not cancel the operation and suggests passing
`ctx.abortSignal` to cancellable APIs. The repro shows that this signal is not aborted when a
step times out, so following that advice does not prevent the duplicate.

## Reproduction

`repro-timeout-continuation/`: run `npm i && npm test`. The repro has two tests, one with
retry-on-timeout and one with a critical timeout.

<details><summary>Core of the test</summary>

```ts
ctx.step({
  name: "charge",
  timeout: 20,
  retryOnTimeout: true,
  maxRetries: 1,
  run: () => provider.charge(ctx.abortSignal, ++attempt === 1 ? 80 : 0),
});
// provider.charge applies the effect unless signal.aborted when it finishes
expect(applied).toEqual([2]); // actual: [1, 2]
```

</details>

## Possible fixes

| Option | Change | Trade-off |
|---|---|---|
| A | Pass a per-attempt `AbortSignal` to step callbacks (`run: ({ signal }) => …`, or abort `ctx.abortSignal` for the attempt) and abort it on timeout | A small API addition; cancellation still depends on user code honoring the signal |
| B | Document that timeouts do not cancel, and warn when `retryOnTimeout` is used | Docs only; the duplicate and orphan risk remains |

Option A plus a note in the documentation would let users write timeout-safe steps today. Using
an idempotency key remains the complete fix for providers that support it.

## Environment

- `@rivet-dev/workflows` 1.0.0 (latest stable as of 2026-10-28)
- Node 22.14, Windows 11 and Linux
- Found while building [ReplayGuard](https://github.com/ashvolt/replayguard).
