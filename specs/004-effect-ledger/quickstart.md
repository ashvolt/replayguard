# Quickstart: Effect Ledger

```ts
import { EffectLedger, instrument } from "@replayguard/core";

const ledger = new EffectLedger();
const charge = instrument(ledger, stripe.charge, {
  kind: "payment",
  subject: (orderId) => orderId,
  idempotencyKey: (_orderId, _amount, key) => key,
  isDeduplicated: (res) => res.replayed === true,
});

await charge("order-1", 500, "wf-1:charge");
ledger.byIdentity("payment::order-1"); // [{ status: "applied", ... }]
```

## Validation scenarios

- Call twice with equal args → 2 attempts, 1 identity.
- Throwing function → attempt `failed`, same error rethrown.
- `subscribe` receives `attempt-started` then `attempt-settled` before the call returns.
- Overlapping slow calls → `overlapping(identity)` returns the pair.
