# Quickstart: Idempotency Helper

```ts
import { idempotencyKey } from "replayguard";

await ctx.step("charge", () =>
  payment.charge({ orderId, amount, idempotencyKey: idempotencyKey(ctx, "charge") }));

// inside a durable loop
await ctx.loop({ name: "notify", state: { i: 0 }, run: async (loopCtx, s) => {
  await loopCtx.step(`send-${s.i}`, () =>
    mailer.send({ to, key: idempotencyKey(loopCtx, "send", { iteration: s.i }) }));
  // ...
}});
```

## Validation scenarios

- H1 scenario without key → `duplicated` + hint `add-idempotency-key`.
- Same scenario with key → `deduplicated`, verdict pass.
- Key built with `Date.now()` → `unstable-idempotency-key` hint.
