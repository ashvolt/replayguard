# ReplayGuard Architecture

Product-level high-level design (HLD) shared by all feature plans. Feature-level HLD/LLD/workflow
diagrams live in `specs/NNN-*/diagrams/`; product diagrams in `docs/architecture/diagrams/`.

## Problem

Durable workflow engines (Rivet) replay *workflow code* safely, but external side effects
(payments, email, APIs) sit outside the durability boundary. Spike F0
(`spikes/engine-assumptions/FINDINGS.md`) proved four concrete gaps in
`@rivet-dev/workflows@1.0.0`: crash-before-flush duplicates (H1), crash loops bypass
`maxRetries` (H2), timeouts leave calls running (H3), and ephemeral results are lost (H4).

ReplayGuard makes those gaps testable: run a workflow, inject faults around its effects, restart
it like a real host, and classify every effect.

## Bounded contexts → packages

| Package | Responsibility | Depends on |
|---|---|---|
| `@replayguard/core` | Ports, effect ledger, instrumentation, fault strategies (in-process), scenario runner, classifier, policy, hints, idempotency keys, report model | — (pure TS) |
| `@replayguard/fakes` | Payment, email, HTTP, webhook test doubles | core |
| `@replayguard/adapter-workflows` | `WorkflowRuntime` for `@rivet-dev/workflows`: faulty driver decorator, file-backed driver, process-kill runtime | core |
| `@replayguard/reporter-console` | Terminal table | core |
| `@replayguard/reporter-html` | Self-contained HTML timeline | core |
| `@replayguard/vitest` | Custom matchers | core |
| `@replayguard/adapter-rivetkit` | `WorkflowRuntime` for RivetKit workflow actors (phase 2) | core, adapter-workflows |
| `replayguard` | Facade re-exporting core + fakes + vitest | core, fakes, vitest |
| `tools/diagrams`, `tools/export`, `tools/quality` | Repo tooling (not published) | — |

Allowed edges are enforced by `tools/quality` (constitution Principle III).

## Core flow

```
Scenario (Builder)
   │ build()
   ▼
ScenarioRunner (Template Method)
   ├─ baseline case ──► WorkflowRuntime port ──► adapter-workflows ──► @rivet-dev/workflows
   │                         ▲  durable store (InMemory | File) wrapped by FaultyDriver (Decorator)
   ├─ discover effect occurrences from baseline ledger
   ├─ FaultMatrix: occurrences × points × strategies (+ explicit cases), budgeted
   └─ per case: fresh store + fresh fakes → arm FaultStrategy → run/restart loop → settle → grace
                    │
                    ▼
               EffectLedger (Observer)  ◄── instrument()/fakes record attempts; hooks let faults fire
                    │ snapshots
                    ▼
               Classifier (Specification rules) + Policy → Verdicts + FixHints
                    │
                    ▼
               Report model ──► Reporters (Visitor): JSON · console · HTML ; Vitest matchers
```

## Key ports (core)

| Port | Purpose | Implementations |
|---|---|---|
| `Clock` | time for ledger/fakes/runner | `systemClock`, `manualClock` (tests) |
| `Sleeper` | wait for retry backoff | real timers, manual (tests) |
| `WorkflowRuntime` | run a workflow once on a durable store, report outcome | engine adapter, RivetKit adapter |
| `PersistenceControl` | let faults stop durable writes / observe write index | `FaultyDriver` |
| `FaultStrategy` | arm a fault on an anchor | none, crash, throwAfter, delay (core); processKill (adapter) |
| `Reporter` | render a report | console, HTML, JSON |

## Design patterns (constitution catalog)

| Pattern | Where | Why |
|---|---|---|
| Ports & Adapters | `WorkflowRuntime`, `PersistenceControl` | Core never imports Rivet; runtimes swappable |
| Strategy | `FaultStrategy` | Add fault mechanics without touching the runner |
| Decorator | `FaultyDriver` wraps any `EngineDriver` | Inject persistence faults without patching Rivet |
| Observer | `EffectLedger.subscribe` | Decouple effect producers from consumers |
| Builder | `scenario()` fluent API | Validated, readable configuration |
| Template Method | `ScenarioRunner.runCase` lifecycle | One fixed lifecycle, pluggable steps |
| Specification | classifier rules | Composable, independently testable outcome predicates |
| Visitor | `ReportVisitor` | New output formats without changing the model |
| Factory | fakes, effect factories per case | Fresh isolated state per case |
| Null Object | `noFault`, `silentReporter` | Remove "no fault" conditionals |

## Cross-cutting decisions

- **No globals:** effects are bound to a ledger through per-case effect factories; no
  AsyncLocalStorage, no monkey patching.
- **Crash semantics:** a crash stops durable writes *and* makes every further instrumented call in
  that run throw `CrashSignal` without invoking the effect — a dead process performs no I/O.
- **Determinism:** time, ids and ordering come from ports; case ordering is seeded.
- **Security:** core has no `node:*` imports; HTML is escaped with strict CSP; process-kill spawns
  only the user's entry module with `shell: false`.
- **Errors:** `ReplayGuardError` base with stable `code`
  (`RG_CONFIG`, `RG_HARNESS`, `RG_BUDGET`, `RG_SCHEMA`, ...).
