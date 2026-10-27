# Quickstart: Fakes

```ts
.effects((ctx) => ({
  payment: createFakePayment(ctx),                    // dedups by idempotencyKey
  email: createFakeEmail(ctx),                        // never dedups
  crm: createFakeHttp(ctx, { routes: [{ method: "POST", path: "/contacts", status: 201,
        idempotencyHeader: "Idempotency-Key" }] }),
  hook: createFakeWebhookReceiver(ctx, { dedup: true }),
}))
```

## Validation scenarios

- `payment.charge` twice with same key → `charges.length === 1`, second result `replayed: true`.
- `email.send` with `fault.loseResponse("email.send")` → `outbox.length === 2`.
- HTTP route with idempotency header, same key twice → second `replayed: true`.
- Webhook dedup on, same event twice → `processed.length === 1`.
