# Outcomes and verdicts

After a scenario runs, the **classifier** looks at each logical effect (`kind::subject`) in each
case and decides what happened to it. It compares the case with the **baseline**, which is the
same workflow run once with no faults.

```ts
import { classify } from "@replayguard/core";

const classified = classify(await myScenario.run(), {
  kinds: { email: { duplicated: "warn" } },
});
// or: await myScenario.run({ classify: true, policy: { ... } })

classified.verdict;                     // "pass" | "warn" | "fail"
classified.cases[1].effects[0].outcome; // "duplicated"
classified.cases[1].effects[0].explanation;
```

`classify` is a pure function: the same result and policy always produce the same output.

## Outcomes

The rules are checked in this order, and the first one that matches wins. In the table,
*expected* means the number of applied plus deduplicated attempts in the baseline, and
*allowed* means `max(expected, 1)`.

| Outcome | Rule | Default verdict | Typical cause |
|---|---|---|---|
| `concurrent-duplicate` | ≥ 2 applied attempts that overlapped in time | fail | Step timeout fired while the call was still running, and the retry called again |
| `duplicated` | applied > allowed | fail | Crash after the effect but before the step result was saved |
| `orphaned` | ≥ 1 applied and the workflow ended `failed` | fail | Effect happened, then the workflow gave up without recording or compensating it |
| `skipped` | expected ≥ 1, nothing applied or deduplicated, and the workflow completed | fail | Lost request or swallowed error |
| `deduplicated` | ≥ 1 attempt the provider reported as a replay, with applied ≤ allowed | pass | Idempotency key worked |
| `exactly-once` | ≥ 1 applied or deduplicated attempt | pass | Normal |

An identity with no applied attempts in a workflow that did not complete (for example a declined
payment in a failed workflow) gets no outcome. Instead the case gets the warning
`<identity> was attempted but never applied (workflow failed)`.

## Verdicts and policy

Each outcome maps to `pass`, `warn` or `fail`. A case takes the worst verdict among its effects,
and the scenario takes the worst verdict among its cases. A harness error makes a case `fail`. A
case that exceeded its budget is at least `warn`.

You can override the strict defaults by identity, by kind or for everything. More specific
overrides win:

1. `identities["email::o-1"]`
2. `kinds["email.welcome"]`, else `kinds["email"]` (exact kind or dotted prefix; the longest
   match wins)
3. `default`
4. built-in defaults (table above)

```ts
classify(result, {
  default: { orphaned: "warn" },
  kinds: { email: { duplicated: "warn" }, "email.receipt": { duplicated: "fail" } },
  identities: { "payment::test-order": { duplicated: "pass" } },
});
```

An invalid policy, such as an unknown outcome name or a verdict other than pass/warn/fail,
throws `ConfigError` (`RG_CONFIG_POLICY`). With `run({ classify: true })` this check happens
before any case runs.

## Explanations

Every classification includes a sentence that ties the outcome to the fault that caused it:

> payment applied 2× (expected 1). Fault F1 (crash after payment#1) stopped run 0 after the
> effect applied but before the step result was saved; run 1 re-executed the step.

If no fault explains a duplicate, the explanation says so. This usually means the workflow calls
the effect more often than the baseline did.

## Warnings and baseline anomalies

These are reported without changing any outcome:

- `attempt #N (identity) was still in flight when the case ended`
- `harness error: <message>`
- `case exceeded its budget; the workflow never settled`

`baselineAnomalies` lists problems with the baseline itself: the baseline did not complete, it
had overlapping calls, or it deduplicated an effect with no fault injected. Any of these makes
the other comparisons less trustworthy.
