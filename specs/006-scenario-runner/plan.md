# Implementation Plan: Scenario Runner & Fault Matrix

**Branch**: `006-scenario-runner` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-scenario-runner/spec.md`

## Summary

Core provides a fluent `scenario()` builder (validated with Valibot), a `ScenarioRunner` with a
fixed per-case lifecycle (Template Method), effect-occurrence discovery from the baseline and a
budgeted `FaultMatrix`, all talking to runtimes through the `WorkflowRuntime` port.
`@replayguard/adapter-workflows` implements the port for `@rivet-dev/workflows` in-process
(`workflowsRuntime()`) and process-isolated (`workflowsProcessRuntime()`) modes.

## Technical Context

**Language/Version**: TypeScript ~6.0

**Primary Dependencies**: core: `valibot`; adapter: peer `@rivet-dev/workflows ^1.0.0`

**Storage**: per case fresh `InMemoryDriver` (in-process) or temp-dir `FileDriver` (process)

**Testing**: Vitest unit (fake runtime implementing the port), integration with the real engine,
fast-check for matrix generation (count = occurrences × points × strategies minus explicit,
deterministic order, budget respected)

**Target Platform**: Node ≥ 22

**Project Type**: Library packages

**Performance Goals**: 20 in-process cases < 5 s (SC-002)

**Constraints**: Every case terminates within budget + grace (SC-004); cases sequential

**Scale/Scope**: ≤ 500 cases per scenario

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | Process runtime spawns only configured module; temp dirs created with `mkdtemp` and removed | PASS |
| II Test-first | Port-level fake runtime enables pure unit tests; spike scenarios as integration tests | PASS |
| III Modularity | Runner in core depends only on ports; Rivet code in adapter | PASS |
| IV Patterns | Builder, Template Method, Ports & Adapters, Factory recorded below | PASS |
| V Public API | Adapter uses `runWorkflow`, `InMemoryDriver`, `EngineDriver` | PASS |
| VI Types | Builder generics carry input/output/effects types | PASS |
| VII Traceability | diagram.yaml + tasks | PASS |
| VIII Docs | Guide "Writing scenarios" | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Many optional settings, invalid combos | **Builder** with build-time validation | Large options object — poor discoverability, late errors |
| Same lifecycle for baseline, explicit and explored cases | **Template Method** (`runCase`: prepare → arm → run/restart loop → settle → grace → snapshot) | Ad-hoc loops per case type |
| Engine vs actor vs process execution | **Ports & Adapters** (`WorkflowRuntime`) | Runner importing Rivet directly |
| Fresh effects/fakes per case | **Factory** (`effects(ctx)` callback) | Shared instances — cross-case contamination |

## Project Structure

```text
packages/core/src/
├── runtime/port.ts            # WorkflowRuntime, RuntimeCase, RunOutcome
├── scenario/
│   ├── builder.ts             # scenario() fluent builder
│   ├── schema.ts              # Valibot validation of options
│   ├── types.ts               # ScenarioDefinition, EffectContext, budgets
│   ├── discovery.ts           # effect occurrences from baseline snapshot
│   ├── matrix.ts              # candidate generation, prioritization, budget
│   ├── runner.ts              # ScenarioRunner (template method)
│   └── result.ts              # CaseResult, ScenarioResult
packages/adapter-workflows/src/
├── runtime.ts                 # workflowsRuntime() in-process
└── process/process-runtime.ts # workflowsProcessRuntime()
```

**Structure Decision**: Runner and matrix in core; runtimes in adapter-workflows.

## Complexity Tracking

No violations.
