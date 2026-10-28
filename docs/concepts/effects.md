# Effects and the effect ledger

An **effect** is a call your workflow makes to the outside world, such as charging a card,
sending an email or calling an API. Durable workflow engines replay *your code* safely after a
crash, but they cannot take back an effect that already happened.

ReplayGuard records every effect attempt in an **effect ledger** so it can later tell whether an
action was repeated, skipped or safely deduplicated.

## Instrumenting an effect

```ts
import { EffectLedger, instrument } from "@replayguard/core";

const ledger = new EffectLedger();
const charge = instrument(ledger, stripe.charge, {
  kind: "payment",                               // what type of effect this is
  subject: (req) => req.orderId,                 // what it acts on (default: hash of the args)
  idempotencyKey: (req) => req.idempotencyKey,   // the key sent to the provider, if any
  isDeduplicated: (res) => res.replayed === true, // whether the provider reported a replay
});
```

The wrapper does not change the arguments, the return value or the thrown error. In scenarios
(feature 006) you get a pre-bound `ctx.instrument` from the effects factory instead of creating a
ledger yourself.

## Attempts and logical effects

Every call becomes an **attempt** with:

- a `seq` number, the `runIndex` of the run that made it, and its start and settle times;
- a `status`: `started`, then exactly one of `applied`, `deduplicated` or `failed`.

Attempts are grouped into a **logical effect** by `identity = kind::subject`. Two attempts with the
same identity are the *same intended real-world action*, which is what makes "charged twice"
detectable.

| Situation | Identity |
|---|---|
| `charge("o-1", 500)` twice | the same, because the default subject hashes the arguments |
| `charge("o-1", 500)` and `charge("o-1", 900)` with `subject: (id) => id` | the same |
| Arguments contain a timestamp or a random ID | **different**, so supply a `subject` function |

Arguments that cannot be hashed (functions, symbols, bigints, invalid dates, cycles) raise
`ConfigError` with code `RG_CONFIG_UNHASHABLE`. Supply a `subject` function for those.

## Privacy

The ledger stores **no argument values** by default, only a hash. To make reports easier to read,
opt in to a redacted preview:

```ts
instrument(ledger, charge, { kind: "payment", preview: (req) => ({ order: req.orderId }) });
```

## Observers and hooks

- `ledger.subscribe(listener)` delivers `run-started`, `attempt-started`, `attempt-settled`,
  `fault` and `run-ended` events. They arrive synchronously and in order, before the instrumented
  call returns. Errors thrown by observers are isolated: they are collected in `observerErrors()`
  and never affect the workflow.
- `ledger.addHooks({ beforeStart, inFlight, afterSettle })` is how **fault strategies** step in.
  Hooks *may* throw or await to simulate a crash before the call, a provider that hangs, or a
  response lost after the provider applied the effect.

## Runs, crashes and late completions

Each restart of the workflow is a new **run**. When a crash fault fires, the run is marked
*dead*: any further instrumented call in that run throws `CrashSignal` without calling the
provider, because a dead process makes no calls. A slow call that was in flight when a fault
happened is flagged with that fault's ID. If it completes after its run ended (spike H3), its
completion is still recorded until the ledger is finalized.
