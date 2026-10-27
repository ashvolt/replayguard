# Implementation Plan: RivetKit Actor Adapter

**Branch**: `012-rivetkit-adapter` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-rivetkit-adapter/spec.md`

## Summary

`@replayguard/adapter-rivetkit` implements `WorkflowRuntime` for workflow actors defined with
`workflow()` from `@rivet-dev/workflows`. Each case runs an **actor host** child process (RivetKit
registry with `startEngine`, temp `RIVETKIT_STORAGE_PATH`, free port) reusing the process relay
protocol from 005. Crash = kill the host process (not the engine); restart = new host attached to
the same storage/engine; resumption verified via actor actions. A shared **runtime conformance
suite** runs against both adapters. Phase 2: starts with a spike task validating host-kill/restart
semantics.

## Technical Context

**Language/Version**: TypeScript ~6.0

**Primary Dependencies**: `@replayguard/core`, `@replayguard/adapter-workflows` (process
protocol); peers `rivetkit >=2.3.11 <2.4.0`, `@rivet-dev/workflows ^1.0.0`

**Storage**: Temp directory per case (`mkdtemp`), removed in `dispose()`

**Testing**: Conformance suite (shared), integration tests tagged `actor` (skipped with explicit
reason when engine binary unavailable)

**Target Platform**: Node ≥ 22 on platforms where RivetKit ships engine binaries

**Project Type**: Library package

**Performance Goals**: actor case < 5 s (SC-002)

**Constraints**: No leaked processes/ports/dirs (SC-003); public APIs only

**Scale/Scope**: integration-level

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | Temp dirs private, processes spawned without shell, engine bound to 127.0.0.1 | PASS |
| II Test-first | Conformance suite written first; spike task before implementation | PASS |
| III Modularity | depends on core + adapter-workflows (allowed edge) | PASS |
| IV Patterns | Ports & Adapters, Template Method (conformance suite) | PASS |
| V Public API | `setup`, `workflow`, `rivetkit/test`, client handles | PASS |
| VII Traceability | diagram.yaml + tasks | PASS |
| VIII Docs | Actor guide | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Same scenarios across engine and actor runtimes | **Ports & Adapters** (`WorkflowRuntime`) | Separate runner for actors |
| All adapters must behave identically | **Template Method** conformance suite parameterized by runtime factory | Copy-pasted adapter tests |
| Host lifecycle (engine, registry, ports, temp dirs) | **Resource object** `ActorHost` with `start/kill/restart/dispose` | Scattered cleanup in tests |

## Project Structure

```text
packages/adapter-rivetkit/src/
├── host/actor-host.ts       # parent-side lifecycle
├── host/host-entry.ts       # child: registry + relay
├── runtime.ts               # rivetkitRuntime()
└── index.ts
packages/adapter-workflows/test-support/conformance.ts   # shared suite (exported for tests)
packages/adapter-rivetkit/test/
├── conformance.actor.test.ts
└── host.actor.test.ts
spikes/actor-restart/        # T-spike: validate kill/restart semantics
```

**Structure Decision**: New package; conformance suite lives with adapter-workflows and is
imported by both adapters' tests.

## Complexity Tracking

No violations.
