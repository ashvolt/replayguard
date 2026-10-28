# Testing RivetKit workflow actors

`@replayguard/adapter-rivetkit` runs your scenario on real RivetKit workflow actors. It uses a
real engine, real actor hosts and real process kills. The scenarios, fakes, classifier,
reports and matchers are the same ones you use with the engine adapter.

**Support.** The adapter supports `rivetkit >=2.3.11 <2.4.0` on Linux and macOS. RivetKit
2.3.x has no working Windows runtime: the native addon is published empty, the engine binary
needs a missing DLL, and the WASM runtime cannot start an engine. The details are in
[the spike findings](../../spikes/actor-restart/FINDINGS.md). On Windows, use WSL.

## Write the scenario module

Every run happens in a separate host process, which loads your scenario from a module. Put the
scenario in a `.mjs` or `.js` file that Node can import, and export a factory for it:

```ts
// checkout.actor.mjs
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

```ts
// checkout.actor.test.ts
import { scenarioFactory } from "./checkout.actor.mjs";

it("charges once even if the host dies", async () => {
  expect(await scenarioFactory().run()).toPassSideEffectPolicy();
}, 300_000);
```

`actorWorkflow(fn, config)` takes your workflow body and the actor's options (`state`,
`actions`, and any other `actor()` option). ReplayGuard builds the actor around them, so it can
tell when the workflow completes or fails. This matters because a failed RivetKit workflow
sleeps instead of throwing. The body uses RivetKit's step API: `run` receives a step context,
and actor state is available there as `step.state`.

## What happens during a case

1. The runtime creates a storage directory for the case and claims a free engine port block.
   An engine started on base port P binds P, P+1 and P+10. You can choose the port with
   `enginePort`.
2. The first run forks a host process. The host starts the RivetKit registry in test mode, which
   also starts the engine, and creates the actor. Every effect pauses at its checkpoints, and the
   test process decides whether to continue, throw, delay or kill.
3. `fault.killAfter(...)` and `fault.crashAfter(...)` send `SIGKILL` to the host right after the
   effect applied. The engine keeps running. The next run starts a new host on the same storage,
   and the engine moves the actor to it. This takes about 15–25 s with rivetkit 2.3.x. The
   workflow then resumes from its persisted history, which re-executes the step whose result was
   never saved.
4. When the case ends, the runtime kills the hosts and the engine, using the PID the engine
   recorded in `runtime.json`, and deletes the storage directory.

All effect fault strategies work: `crash` (kill), `processKill`, `throwAfter` and `delay`. A
timed-out call keeps running in its host and lands later, so `concurrent-duplicate` and
`orphaned` behave as they do with the engine adapter. Durable-write anchors are not supported,
because the engine owns its storage.

## Budgets and speed

Engines start in about 4 s, and a kill case costs about 25 s. Raise the case budget
(`caseTimeoutMs: 120_000` is a good start) and give vitest a generous timeout. Keep `explore()`
small, or use explicit cases, for actor scenarios. Use the in-process engine adapter for broad
exploration and actors for end-to-end confirmation.

## Running the actor tests in this repo

The actor integration suites (`packages/adapter-rivetkit/test/*.actor.test.ts`) start real
engines, so they run only when you opt in:

```sh
REPLAYGUARD_ACTOR_TESTS=1 pnpm --filter @replayguard/adapter-rivetkit exec vitest run test/conformance.actor.test.ts
```

CI runs them in the `rivetkit` job on Ubuntu, for rivetkit 2.3.11 and 2.3.27. The Linux engine
binary is published only as a musl build. The workspace therefore sets
`supportedArchitectures.libc: [current, musl]`; without it, pnpm skips the binary on glibc
systems. Copy that setting into your own project if you use pnpm.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `no_runner_config_configured` | The registry is not in test mode, or the services sidecar failed. The adapter sets both for you; check for a stale engine on the same port. |
| `No usable engine binary was found` | The `@rivetkit/engine-cli-*` platform package was not installed (pnpm with glibc; see above). |
| The case times out after a kill | The engine takes up to about 25 s to move the actor. Raise `caseTimeoutMs`. |
| `rivet-engine` processes left running | The test process was killed before cleanup. Kill them manually; each storage directory's `.rivetkit/var/engine/runtime.json` has the PID. |
