# Research: Fake Services

## R1 — Idempotency semantics (modelled on widely documented provider behavior)

- Same key + same parameters → return the original result, mark as replay (dedup).
- Same key + different parameters → `IdempotencyConflictError` (status 409/422-like).
- Same key while first request in flight → default `IdempotencyInFlightError` (conflict);
  option `inFlight: "wait"` waits for and returns the first result.
- Parameter fingerprint: canonical hash from core (`canonicalHash`).

## R2 — Effect kinds

| Fake | Operation | Kind | Default subject |
|---|---|---|---|
| payment | `charge(req)` | `payment.charge` | `req.orderId` |
| payment | `refund(chargeId)` | `payment.refund` | `chargeId` |
| email | `send(msg)` | `email.send` | `to + "|" + template` (or hash of msg) |
| http | `request(method, path, opts)` | `http:METHOD path` | hash of body |
| webhook | `deliver(event)` | `webhook.deliver` | `event.id` |

Users override subjects via options.

## R3 — Latency

`latencyMs` option awaited through `ctx.sleeper` (or real timers without ctx) **inside** the
recorded operation so delays count as in-flight time.

## R4 — Failure scripting

`failures: { times: number, error?: () => Error, status?: number }` — first N calls fail before
applying (no state change); deterministic.

## R5 — Read-only state

Getters return frozen copies (`charges`, `outbox`, `requests`, `processed`, `deliveries`).
