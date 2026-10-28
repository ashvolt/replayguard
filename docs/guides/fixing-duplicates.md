# Fixing duplicate side effects

A durable workflow re-executes a step whenever it cannot prove the step finished. That happens
after a crash, a lost response or a step timeout. If the step charged a card or sent an email,
re-executing it does that again. ReplayGuard shows when this happens. This guide shows how to fix
it.

## 1. Find the duplicate

```ts
const classified = await checkout.run({ classify: true });
for (const c of classified.cases) {
  for (const e of c.effects) {
    if (e.verdict !== "pass") console.log(c.name, e.outcome, e.explanation, e.hints[0]?.title);
  }
}
```

Each effect that does not pass carries at least one **hint**, which includes a short code example
(see [outcomes](../concepts/outcomes.md)).

## 2. Send a stable idempotency key

Most providers (payments, many REST APIs) deduplicate requests that carry the same idempotency
key. The key must be the **same on every re-execution**, so build it only from stable inputs:

```ts
import { idempotencyKey } from "replayguard";

await ctx.step("charge", () =>
  payment.charge({ orderId, amount, idempotencyKey: idempotencyKey(ctx, "charge") }));
```

`idempotencyKey(ctx, step, options?)` returns `[namespace/]workflowId:step[#iteration][:part…]`:

- Every component is escaped (`%`, `:`, `#`, `/`), so different inputs always give different keys.
- Keys longer than 255 characters become a readable 200-character prefix plus `:h<hash>`.
- An empty workflow ID or step name throws `ConfigError` (`RG_CONFIG_IDEMPOTENCY_KEY`).

Inside a durable loop, pass the iteration:

```ts
await ctx.loop({ name: "notify", state: { i: 0 }, run: async (loopCtx, s) => {
  await loopCtx.step(`send-${s.i}`, () =>
    mailer.send({ to, key: idempotencyKey(loopCtx, "send", { iteration: s.i }) }));
  // ...
}});
```

Never put the attempt number, the time or a random value in the key. Retry counters reset when
the process restarts (crash loops bypass `maxRetries`), and a time-based key changes on every
retry. ReplayGuard reports this as the `unstable-idempotency-key` hint.

Run the scenario again. The duplicated effect now shows as **deduplicated**, and the verdict is
`pass`.

## 3. Hints and what to do

| Hint | When | Fix |
|---|---|---|
| `add-idempotency-key` | duplicated, no key sent | Send `idempotencyKey(ctx, step)` |
| `provider-ignores-key` | duplicated, one stable key, no dedup | Check that the provider honors the key (field or header name, feature enabled) |
| `unstable-idempotency-key` | several keys for one effect | Remove time, randomness and attempt numbers from the key |
| `timeout-retry-concurrency` | overlapping calls after a delay fault | A step timeout does not cancel the call. Send a key, pass `ctx.abortSignal`, or avoid `retryOnTimeout` without a key |
| `orphan-compensate` | applied, then the workflow failed | Add a compensation step, or make the step retryable with a key |
| `crash-loop-retries` | > 3 applies across repeated crashes | Keys are mandatory, because `maxRetries` does not bound crash loops |
| `skipped-ephemeral` | expected effect never applied | Don't swallow errors; check ephemeral steps |
| `allow-by-policy` | notification-like kinds (`email`, `webhook`, `sms`, `push`) | If an occasional repeat is acceptable, lower the verdict with a policy override |
| `investigate` | nothing else matched | Compare the ledger with the baseline |

## 4. When the provider has no idempotency

Email and many webhooks cannot deduplicate on the provider side. In that case:

- Record what was sent in durable state *before* the side effect, and check it on re-execution.
  Note that a crash between the effect and the record still duplicates.
- Make the receiver deduplicate (for example, webhook receivers dedup by `webhook-id`).
- Accept the risk explicitly with a policy:
  `{ kinds: { "email.send": { duplicated: "warn" } } }`.
