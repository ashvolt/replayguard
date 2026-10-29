<!--
DRAFT: not filed. Requires ReplayGuard maintainer approval (spec 013, FR-004).
Title: Expose a stable step identity inside step callbacks (for idempotency keys)
Repo: rivet-dev/workflows
Labels: enhancement
-->

## Summary

The recommended fix for duplicate side effects is an idempotency key that stays the same when a
step re-executes and differs for every distinct step execution. Inside a step callback, the only
public identity is `ctx.workflowId`. The engine knows the step's location (its name plus loop
iteration and nesting), but users cannot read it, so they must rebuild it by hand. When they get
it wrong, keys either collide or change between re-executions.

## Observed

In a loop, `loopCtx.step("send", …)` in iteration 0 and in iteration 1 both see the same public
context. The obvious key, `${ctx.workflowId}:send`, is identical for both iterations, so a
provider that deduplicates by key silently drops the second, legitimate email.

## Expected

A step callback can read a stable identifier for its own location. The identifier is the same
when that step re-executes after a crash, and different for each distinct step execution,
including each loop iteration and each branch.

## Impact

Idempotency keys are the main defense against at-least-once re-execution, which is the gap
behind issues 01 and 02. Without a stable step identity, every user has to thread loop counters
and branch names into their keys by hand, and mistakes are silent: dropped requests or duplicate
effects.

## Reproduction

[`repro-stable-step-identity`](https://github.com/ashvolt/replayguard/tree/main/upstream/repro-stable-step-identity): run `npm i && npm test`. The test also crashes iteration 1 once,
to show that a re-executed iteration derives the same key, so stability already holds.

<details><summary>Core of the test</summary>

```ts
ctx.loop({ name: "notify", state: 0, run: async (loopCtx, i) => {
  await loopCtx.step("send", async () => {
    const key = `${loopCtx.workflowId}:send`; // best key from public context today
    // ...
  });
  return i < 1 ? Loop.continue(i + 1) : Loop.break(undefined);
}});
expect(keyOfIteration0).not.toBe(keyOfIteration1); // actual: both "wf-1:send"
```

</details>

## Possible fixes

| Option | Change | Trade-off |
|---|---|---|
| A | Expose a read-only `stepKey` (for example `locationToKey` of the current entry, prefixed with the workflow ID) on the context passed to, or available inside, step callbacks | A small API addition; the format becomes part of the public contract |
| B | Export a helper, `stepIdentity(ctx)`, that derives the key from public context | No change to the context shape, but it still needs access to the location |

Either option lets libraries (ReplayGuard ships `idempotencyKey(ctx, step, { iteration })` as a
stopgap) and providers' SDKs build correct keys without guessing.

## Environment

- `@rivet-dev/workflows` 1.0.0 (latest stable as of 2026-10-28)
- Node 22.14, Windows 11 and Linux
- Found while building [ReplayGuard](https://github.com/ashvolt/replayguard).
