# ReplayGuard

[![CI](https://github.com/ashvolt/replayguard/actions/workflows/ci.yml/badge.svg)](https://github.com/ashvolt/replayguard/actions/workflows/ci.yml)
[![Security](https://github.com/ashvolt/replayguard/actions/workflows/security.yml/badge.svg)](https://github.com/ashvolt/replayguard/actions/workflows/security.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**Does your durable workflow charge the card twice when it crashes?**

[Rivet](https://rivet.dev) workflows replay safely after crashes and restarts, but calls to
external systems (payments, email, APIs) sit outside that durability guarantee. ReplayGuard runs
your workflow, injects crashes, lost responses and timeouts around each external call, restarts it
the way a real host would, and reports the outcome for every effect:

| Outcome | Meaning | Default verdict |
|---|---|---|
| `exactly-once` | Applied once | pass |
| `deduplicated` | Retried, and the provider deduplicated it (idempotency key) | pass |
| `duplicated` | Applied more than once | fail |
| `concurrent-duplicate` | Applied twice with overlapping calls (timeout + retry) | fail |
| `orphaned` | Applied, but the workflow failed or never recorded it | fail |
| `skipped` | Expected but never applied | fail |

> **Status:** pre-release. Every spec in [`specs/`](specs/) is implemented. Packages are not
> yet published. [`spikes/engine-assumptions/FINDINGS.md`](spikes/engine-assumptions/FINDINGS.md)
> describes the engine behaviors ReplayGuard detects.

## Example

This example runs as a test in `packages/replayguard/test/index.test.ts`.

```ts
// vitest.config.ts: test: { setupFiles: ["replayguard/setup"] }
import { createFakePayment, fault, idempotencyKey, scenario } from "replayguard";
import { workflowsRuntime } from "@replayguard/adapter-workflows";

const result = await scenario()
  .runtime(workflowsRuntime())
  .effects((ctx) => ({ payment: createFakePayment(ctx) }))
  .workflow(({ payment }) => async (wf) =>
    wf.step("charge", () =>
      payment.charge({ orderId: "o-1", amount: 500, idempotencyKey: idempotencyKey(wf, "charge") })))
  .case("crash after charge", [fault.crashAfter("payment.charge")])
  .explore()
  .build()
  .run({ classify: true });

expect(result).toPassSideEffectPolicy();
```

Remove the `idempotencyKey` and the test fails, because the crash makes the payment
`duplicated`. Each failing effect explains its cause and comes with a fix hint. See
[outcomes](docs/concepts/outcomes.md), [fixing duplicates](docs/guides/fixing-duplicates.md),
[fakes](docs/fakes/README.md), [reporters](docs/reporters/README.md),
[Vitest matchers](docs/vitest/README.md) and [RivetKit actors](docs/guides/rivetkit-actors.md).

## Packages

| Package | Purpose |
|---|---|
| `replayguard` | Facade over core, fakes and Vitest matchers |
| `@replayguard/core` | Effect ledger, faults, scenario runner, classifier, report model (pure TS) |
| `@replayguard/fakes` | Fake payment, email, HTTP and webhook services |
| `@replayguard/adapter-workflows` | `@rivet-dev/workflows` runtime (in-process and process-kill) |
| `@replayguard/adapter-rivetkit` | RivetKit workflow actor runtime |
| `@replayguard/reporter-console` / `-html` | Terminal table and self-contained HTML timeline |
| `@replayguard/vitest` | `toPassSideEffectPolicy()` and other matchers |

## Repository

- [Constitution](.specify/memory/constitution.md): principles, quality gates and design patterns
- [Architecture](docs/architecture/README.md): HLD, ports and patterns; diagrams are in
  `docs/architecture/diagrams/`
- [Specs](specs/): one folder per feature, each with HLD, LLD, workflow and architecture diagrams
- [Backlog exports](exports/): Jira CSV/JSON, GitHub Issues and generic CSV
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) ·
  [Releasing](docs/maintainers/releasing.md)

## License

[Apache-2.0](LICENSE)
