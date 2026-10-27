# Quickstart: Scenario Runner

```ts
import { scenario, fault } from "@replayguard/core";
import { workflowsRuntime } from "@replayguard/adapter-workflows";
import { createFakePayment } from "@replayguard/fakes";

const result = await scenario()
  .name("checkout")
  .runtime(workflowsRuntime())
  .effects((ctx) => ({ payment: createFakePayment(ctx) }))
  .workflow(({ payment }) => async (wf) =>
    wf.step("charge", () => payment.charge({ orderId: "o-1", amount: 500 })))
  .case("crash after charge", [fault.crashAfter("payment.charge")])
  .explore()
  .build()
  .run();

result.cases.map((c) => [c.name, c.status, c.restarts]);
```

## Validation scenarios

- Explicit crash case → `restarts: 1`, two applied `payment.charge` attempts in the ledger.
- `explore()` on a 2-effect workflow → 8 explored cases (2 occurrences × 2 points × 2 strategies).
- Never-settling workflow with `budget({ caseTimeoutMs: 200 })` → `budget-exceeded` in ≤ 250 ms.
