# Checkout demo

A two-step workflow (charge the card, email a receipt) on the real `@rivet-dev/workflows` engine.
ReplayGuard explores crashes and lost responses around both effects:

1. As written, a crash after the charge re-executes the step: **the customer is charged twice**.
   The report explains the cause and suggests the fix.
2. With `idempotencyKey(wf, "charge")` the provider recognises the replay: the payment is
   **deduplicated**. The receipt email still sends twice (email has no idempotency) — still FAIL.
3. Decide repeated receipts are acceptable and say so in the verdict policy: **WARN**, not FAIL.

```sh
pnpm build && pnpm demo
```

HTML timelines are written to `reports/demo-1.html` … `reports/demo-3.html`.
