# Quickstart: RivetKit Adapter

```ts
// checkout.actor.mjs (loaded by each actor host process)
import { actorWorkflow, rivetkitRuntime } from "@replayguard/adapter-rivetkit";
import { fault, scenario } from "@replayguard/core";
import { createFakePayment } from "@replayguard/fakes";

export const scenarioFactory = () =>
  scenario()
    .runtime(rivetkitRuntime({ scenarioModule: import.meta.url }))
    .effects((ctx) => ({ payment: createFakePayment(ctx) }))
    .workflow(({ payment }) =>
      actorWorkflow(
        async (ctx) => {
          await ctx.step("charge", (step) =>
            payment.charge({ orderId: step.state.orderId, amount: 500 }));
        },
        { state: { orderId: "o-1" } },
      ))
    .budget({ caseTimeoutMs: 120_000, graceMs: 3_000 })
    .case("kill after charge", [fault.killAfter("payment.charge")])
    .build();
```

## Validation scenarios

- The conformance suite passes for the in-process engine, the process runtime and actors, with
  identical outcomes (`test/conformance.*.test.ts`).
- A real host kill resumes on a new host, and the duplicate charge is classified
  (`restart.actor.test.ts`).
- After the suite, no `rivet-engine` process and no temp directories are left
  (`leaks.actor.test.ts`).
- Verified on Linux (WSL Ubuntu) with rivetkit 2.3.11 and 2.3.27 on 2026-10-28. Windows is not
  supported by rivetkit 2.3.x; see `spikes/actor-restart/FINDINGS.md`.
