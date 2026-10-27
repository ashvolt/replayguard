# Implementation Plan: Fault Injection Strategies

**Branch**: `005-fault-injection` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-fault-injection/spec.md`

## Summary

Core defines `FaultSpec`, anchors, the `FaultStrategy` interface, a `FaultController` that arms
specs on a ledger via `EffectHooks`, and the in-process strategies `none`, `crash`, `throwAfter`,
`delay`. `@replayguard/adapter-workflows` adds `FaultyDriver` (Decorator over any Rivet
`EngineDriver`, implementing `PersistenceControl`), `FileDriver` (persistent `EngineDriver` for
cross-process restarts) and the `processKill` strategy with a child-process host and an IPC
relay protocol carrying ledger events and a per-settle sync point for deterministic kills.

## Technical Context

**Language/Version**: TypeScript ~6.0

**Primary Dependencies**: core: none; adapter-workflows: peer `@rivet-dev/workflows` `^1.0.0`,
`node:child_process`, `node:fs/promises`, `node:path`

**Storage**: `FileDriver` writes `<dir>/kv.json` atomically (write temp + rename)

**Testing**: Vitest; spike F0 tests ported as acceptance tests; `FileDriver` passes a shared
driver conformance suite also run against `InMemoryDriver`; process tests tagged `integration`

**Target Platform**: Node ≥ 22 on Linux, Windows, macOS

**Project Type**: Library packages (core + adapter)

**Performance Goals**: in-process case < 200 ms; process-kill case < 3 s (SC-003)

**Constraints**: No engine patching; child spawned with `fork`/`execPath`, fixed args, no shell;
IPC payloads are validated plain data

**Scale/Scope**: ≤ 10 faults per case

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | `shell: false`, entry module allowlisted from scenario config, IPC schema-validated | PASS |
| II Test-first | Spike H0–H4 become failing acceptance tests first | PASS |
| III Modularity | In-process strategies in core; OS/process + Rivet code in adapter | PASS |
| IV Patterns | Strategy, Decorator, Null Object recorded below | PASS |
| V Public API | Only `EngineDriver`, `InMemoryDriver`, `runWorkflow` | PASS |
| VI Types | Discriminated unions for anchors/specs | PASS |
| VII Traceability | diagram.yaml + tasks | PASS |
| VIII Docs | One docs page per strategy with spike evidence | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Several fault mechanics with one lifecycle (arm → fire once → report) | **Strategy** (`FaultStrategy`) | Switch on fault type inside the runner |
| Stop durable writes without touching Rivet | **Decorator** (`FaultyDriver` wraps `EngineDriver`) | Monkey-patching `InMemoryDriver.prototype` — forbidden by Principle V |
| "No fault" baseline without conditionals | **Null Object** (`noFault`) | `if (fault)` checks everywhere |
| Deterministic kill timing across processes | **Synchronous handshake** at `afterSettle` (child awaits parent `continue`/is killed) | Kill on event receipt — child races ahead and performs extra writes |

## Project Structure

```text
packages/core/src/
├── ports/sleeper.ts             # Sleeper, systemSleeper
├── ports/persistence.ts         # PersistenceControl port
└── faults/
    ├── types.ts                 # FaultSpec, FaultAnchor, FaultPoint, FaultOutcome
    ├── strategy.ts              # FaultStrategy interface, registry
    ├── controller.ts            # FaultController (arms specs onto ledger hooks)
    ├── errors.ts                # SimulatedNetworkError
    └── strategies/{none,crash,throw-after,delay}.ts
packages/adapter-workflows/src/
├── faulty-driver.ts             # Decorator + PersistenceControl
├── file-driver.ts               # persistent EngineDriver
└── process/
    ├── protocol.ts              # IPC message schema (valibot)
    ├── child-host.ts            # runs in child: rebuild scenario, relay ledger events
    ├── child-entry.ts           # executable entry (fork target)
    └── process-kill.ts          # processKill strategy + parent-side controller
packages/adapter-workflows/test/
├── driver-conformance.ts        # shared suite
├── faulty-driver.test.ts  file-driver.test.ts
├── spike-parity.test.ts         # H0–H4 via public API
└── process-kill.integration.test.ts
```

**Structure Decision**: Split across core (pure strategies) and adapter-workflows (Rivet + OS).

## Complexity Tracking

No violations.
