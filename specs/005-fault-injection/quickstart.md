# Quickstart: Fault Injection

```ts
import { fault } from "@replayguard/core";

fault.crashAfter("payment");          // H1: crash after provider applied, before save
fault.loseResponse("email");          // H0: provider applied, caller gets ECONNRESET
fault.delay("payment", 500);          // H3: provider hangs past a 50 ms step timeout
fault.crashAtWrite(3);                // crash before the 3rd durable write
fault.killAfter("payment");           // real process kill (adapter-workflows)
```

Faults are passed to scenarios (feature 006):

```ts
scenario()
  .workflow(checkout)
  .effects(effects)
  .faults([fault.crashAfter("payment")])
  .build();
```

## Validation scenarios (spike parity)

| Spike | Fault | Expected ledger |
|---|---|---|
| H1 | `crashAfter("payment")` | 2 applied payment attempts, 1 fault |
| H2 | 5× `crashAfter("payment", n)` | 6 applied with `maxRetries: 2` |
| H3a | `delay("payment", 80)` + step timeout 20 + `retryOnTimeout` | 2 applied, overlapping |
| H4 | ephemeral email + `crashAfter("payment")` | 2 applied emails |
