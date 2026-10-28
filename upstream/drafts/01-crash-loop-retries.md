<!--
DRAFT: not filed. Requires ReplayGuard maintainer approval (spec 013, FR-004).
Title: Crash during a step is not counted toward maxRetries, so crash loops re-run the step without bound
Repo: rivet-dev/workflows
Labels: bug, durability
-->

## Summary

If the process dies while a step's `run()` is executing, the attempt is not counted, so
`maxRetries` does not limit how often the step runs. In a crash loop, for example an OOM caused
by the step itself or a deploy that keeps killing the worker, a non-idempotent call inside the
step repeats on every restart.

## Observed

With `maxRetries: 2` and a process that crashes 5 times during `run()`, the step executes
**6 times** and the workflow then completes. No `StepExhaustedError` is raised.

## Expected

A step with `maxRetries: 2` runs at most 3 times, whether an attempt ends with an error or with a
crash. Once the limit is reached, the step is exhausted.

## Impact

`maxRetries` is how users bound the cost of retrying a side effect such as a charge or an email.
That bound currently holds only for errors thrown inside `run()`, not for crashes, which are the
failures durable execution is meant to survive. Users cannot detect this from public APIs.

## Reproduction

A standalone package (about 60 lines, no dependencies besides `@rivet-dev/workflows` and Vitest):
`repro-crash-loop-retries/`. Run `npm i && npm test`.

<details><summary>Core of the test</summary>

```ts
const wf = async (ctx: WorkflowContextInterface) =>
  ctx.step({
    name: "charge",
    maxRetries: 2,
    run: async () => {
      executions++;
      if (crashesLeft-- > 0) driver.crash(); // writes fail from here on
      return "ok";
    },
  });
// restart loop: runWorkflow(..., { mode: "yield" }) on the same storage after each crash
expect(executions).toBeLessThanOrEqual(3); // actual: 6
```

</details>

## Possible fixes

| Option | Change | Trade-off |
|---|---|---|
| A | Persist the step's attempt metadata (`attempts + 1`, status `running`) before calling `run()` | One extra write per attempt; ephemeral steps could opt out |
| B | Persist a small "started" marker for the attempt, and count markers on replay | A smaller write, but a second source of truth |

With either option, a restart that finds an attempt marked as started but unfinished counts it
as failed, which also makes the crash visible in history.

## Environment

- `@rivet-dev/workflows` 1.0.0 (latest stable as of 2026-10-28)
- Node 22.14, Windows 11 and Linux
- Found while building [ReplayGuard](https://github.com/ashvolt/replayguard), a test library
  that injects crashes around side effects in Rivet workflows.
