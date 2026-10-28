# Writing scenarios

A **scenario** runs your workflow several times: first a clean **baseline**, then one **case** per
fault. Each case runs with fresh storage and fresh effects.

```ts
import { fault, scenario } from "@replayguard/core";
import { workflowsRuntime } from "@replayguard/adapter-workflows";

const result = await scenario()
  .name("checkout")
  .runtime(workflowsRuntime())
  .effects((ctx) => ({                                   // called once per case
    charge: ctx.instrument(stripe.charge, { kind: "payment" }),
  }))
  .workflow(({ charge }) => async (wf) => {              // called once per case
    await wf.step("charge", () => charge({ orderId: "o-1", amount: 500 }));
  })
  .case("crash after charge", [fault.crashAfter("payment")])  // explicit case
  .explore()                                             // plus automatically generated cases
  .budget({ maxRuns: 20, caseTimeoutMs: 10_000, graceMs: 25 })
  .build()
  .run();
```

## What happens in each case

The steps are always the same:

1. **Prepare.** Create a fresh ledger, fresh effects and fresh durable storage.
2. **Arm.** Arm the case's faults.
3. **Run and restart.** Run the workflow. Whenever it **crashes**, restart it from durable state.
4. **Retries.** When it **sleeps** (retry backoff), wait until the wake time, the way a host does.
5. **Messages.** When it **waits** for a message, deliver any scripted `deliver(...)` messages.
   Otherwise the case settles as `waiting`.
6. **Grace.** Wait `graceMs` so that late completions (e.g. a provider that answered after a
   timeout) are recorded.
7. **Snapshot.** Take the final ledger snapshot.

A case's `status` is one of:

- `settled`: it finished normally.
- `budget-exceeded`: it hit `maxRuns` or `caseTimeoutMs`.
- `harness-error`: the test harness itself failed, not your workflow.

## Exploration

`explore()` discovers every effect occurrence in the baseline and generates one case for each
occurrence × point × strategy:

| Option | Default |
|---|---|
| `strategies` | `["crash", "throwAfter"]` (add `"delay"` together with `delayMs`, or `"processKill"` on the process runtime) |
| `points` | `["after", "before"]`; after-points run first |
| `maxCases` | 50; candidates over budget are listed in `result.skipped` |
| `sample` | `"first"` follows priority order; `"random"` takes a sample chosen by `seed` |
| `kinds` | all kinds; restrict to e.g. `["payment.charge"]` |

Generated case names look like `crash@after:payment#1` or `throwAfter@before:email#2`. Explicit
cases are never generated a second time.

## Tips

- The engine reads real time for retries, so keep `retryBackoffBase` and `retryBackoffMax` small
  in tests.
- Keep effect arguments stable across retries, or pass a `subject` function. Effects are grouped by
  `kind` + `subject`.
- Use a fixed `workflowId` (the default is `replayguard-wf`). Keys derived from it then stay stable
  across restarts.
- Cases run one after another. To run several scenarios in parallel, put them in different test
  files.
