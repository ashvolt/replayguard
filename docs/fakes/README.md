# Fake services

`@replayguard/fakes` provides in-memory stand-ins for the external services a workflow usually
calls:

- They record every call in the case's effect ledger.
- They behave like real providers where that matters for duplicates (idempotency keys, replays,
  conflicts).
- They never touch the network or the file system.

Create the fakes inside `.effects()`, so each case gets fresh fakes with fresh state:

```ts
import { createFakeEmail, createFakeHttp, createFakePayment, createFakeWebhookReceiver } from "@replayguard/fakes";

scenario()
  .effects((ctx) => ({
    payment: createFakePayment(ctx),
    email: createFakeEmail(ctx),
    crm: createFakeHttp(ctx, {
      routes: [{ method: "POST", path: "/contacts", status: 201, idempotencyHeader: "Idempotency-Key" }],
    }),
    hook: createFakeWebhookReceiver(ctx),
  }))
```

Without `ctx` (for example in a plain unit test), the fakes still work. They record nothing and
use real timers for latency.

## Common behavior

| Option | Meaning |
|---|---|
| `latencyMs` | Processing time. It is awaited *inside* the recorded call through `ctx.sleeper`, so it counts as in-flight time and works with `fault.delay` and step timeouts. |
| `failures: { times, status?, error? }` | The first `times` calls fail before anything is applied. Payment and email throw `FakeServiceError` (status 503 by default). |
| `subject` | Overrides the logical subject (see [effects](../concepts/effects.md)). |

The state getters (`charges`, `outbox`, `requests`, `processed`, `deliveries`) return frozen
copies. Ids are sequential per instance (`ch_000001`, `msg_000001`), so tests stay deterministic.

## Payment — `createFakePayment(ctx?, options?)`

| Operation | Kind | Default subject |
|---|---|---|
| `charge({ orderId, amount, currency?, idempotencyKey? })` | `payment.charge` | `orderId` |
| `refund(chargeId)` | `payment.refund` | `chargeId` |

- `amount` must be an integer greater than 0, in minor units. `currency` must be a 3-letter
  code; the default is `usd`. Invalid requests throw `FakeServiceError` (status 400) and are
  recorded as failed.
- If you send the same `idempotencyKey` with the same parameters, the fake returns the original
  charge with `replayed: true`. The attempt is recorded as **deduplicated**.
- If you reuse a key with different parameters, the fake throws `IdempotencyConflictError`
  (`RG_FAKE_IDEMPOTENCY_CONFLICT`).
- A same-key request that arrives while the first is still processing throws
  `IdempotencyInFlightError` (`RG_FAKE_IDEMPOTENCY_IN_FLIGHT`). With `inFlight: "wait"`, it
  waits and replays the first result instead.
- `idempotency: false` makes the provider ignore keys, so every call creates a charge.
- A failed request does not store its key, so the retry runs normally.

## Email — `createFakeEmail(ctx?, options?)`

`send({ to, template, data? })` has kind `email.send`. The default subject is `to|template`.
Email never deduplicates, so a lost response or a crash after sending produces two messages in
`outbox`. This is the classic duplicate email.

## HTTP — `createFakeHttp(ctx?, { routes })`

`request(method, path, { headers?, body? })` returns `{ status, body, replayed }`.

- The kind is `http:<METHOD> <path>`, for example `http:POST /orders`. The subject is a hash of
  the body.
- Route fields are `method`, `path`, `status` (default 200), `body` (a value, or a function
  called once per applied request), `latencyMs` and `idempotencyHeader`.
- If you set `idempotencyHeader`, the fake looks up that header case-insensitively and applies
  the same replay and conflict rules as the payment fake.
- An unknown route answers 404, and any status of 400 or above is returned to the caller
  (nothing is thrown). The attempt is recorded as **failed**.

## Webhook receiver — `createFakeWebhookReceiver(ctx?, options?)`

`deliver({ id, type, payload })` has kind `webhook.deliver` and the subject is the event id.

- With `dedup` on (the default), an event id that was already processed is acknowledged with
  `{ status: 200, deduplicated: true }` and recorded as **deduplicated**. This matches what
  webhook receivers are told to do.
- `failFirst: N` answers 500 to the first N deliveries. Those deliveries are recorded as failed,
  and the event is not processed.

## Building your own fake

`recordable(ctx, fn, options)` is the building block every fake uses. It accepts the
`instrument()` options plus `latencyMs`, `failures` and `failureResponse`. If your fake throws
`new FailedResponse(response)` inside `fn`, the attempt is recorded as failed and the caller
still gets `response`.

```ts
const sendSms = recordable(ctx, async (to: string, text: string) => ({ sid: "SM1" }), {
  kind: "sms.send",
  subject: (to) => to,
  latencyMs: () => 20,
});
```

See [outcomes](../concepts/outcomes.md) for how these recordings become verdicts. The tests in
`packages/fakes/test/outcomes.examples.test.ts` reproduce every outcome class.
