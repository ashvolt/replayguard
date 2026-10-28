---

description: "Task list for 012-rivetkit-adapter"
---

# Tasks: RivetKit Actor Adapter

**Input**: Design documents from `/specs/012-rivetkit-adapter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (conformance suite first).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Configure dependencies (core, adapter-workflows) and peers (`rivetkit >=2.3.11 <2.4.0`, `@rivet-dev/workflows ^1.0.0`) in packages/adapter-rivetkit/package.json
- [X] T002 Spike: validate actor host kill + restart resumes workflow from persisted history; record decision (parent-owned engine vs restart both) in spikes/actor-restart/FINDINGS.md

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T003 Extract shared runtime conformance suite (H0, H1, H1b, H3a, H3b, H4, clean baseline) parameterized by runtime factory in packages/adapter-workflows/test-support/conformance.ts
- [X] T004 Run conformance suite against `workflowsRuntime()` in packages/adapter-workflows/test/conformance.engine.test.ts

---

## Phase 3: User Story 1 - Run a scenario against a workflow actor (Priority: P1) 🎯 MVP

**Goal**: `rivetkitRuntime()` executes baseline + fault cases on actors.

**Independent Test**: Conformance suite passes for actor runtime with identical outcomes.

- [X] T005 [P] [US1] Write failing ActorHost lifecycle tests (start on free port + temp storage, ready detection, dispose cleans processes/dirs) in packages/adapter-rivetkit/test/host.actor.test.ts
- [X] T006 [US1] Implement child host entry (registry with workflow actor, relay ledger events via 005 protocol) in packages/adapter-rivetkit/src/host/host-entry.ts
- [X] T007 [US1] Implement ActorHost resource (state machine "idle → starting → ready → killed|stopped → disposed") in packages/adapter-rivetkit/src/host/actor-host.ts
- [X] T008 [US1] Implement `rivetkitRuntime()` WorkflowRuntime in packages/adapter-rivetkit/src/runtime.ts
- [X] T009 [US1] Run conformance suite against actor runtime in packages/adapter-rivetkit/test/conformance.actor.test.ts

---

## Phase 4: User Story 2 - Actor crash and restart (Priority: P1)

**Goal**: Kill host at anchor, restart on same storage, resume.

**Independent Test**: killAfter payment → actor resumes, outcome matches engine adapter.

- [X] T010 [P] [US2] Write failing crash/restart and sleep/wake tests in packages/adapter-rivetkit/test/restart.actor.test.ts
- [X] T011 [US2] Implement kill/restart per T002 decision in packages/adapter-rivetkit/src/host/actor-host.ts

---

## Phase 5: User Story 3 - Version compatibility (Priority: P2)

**Goal**: CI matrix over supported RivetKit versions.

**Independent Test**: Matrix job green for min and latest 2.3.x.

- [X] T012 [US3] Add RivetKit version matrix job (2.3.11, latest 2.3.x) with explicit skip message when engine binary unavailable in .github/workflows/ci.yml

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 [P] Leak check (no engine processes/temp dirs after suite) in packages/adapter-rivetkit/test/leaks.actor.test.ts
- [X] T014 [P] Actor guide in docs/guides/rivetkit-actors.md
- [X] T015 Author diagrams covering T001–T016 in specs/012-rivetkit-adapter/diagram.yaml
- [X] T016 Validate quickstart scenarios in specs/012-rivetkit-adapter/quickstart.md

## Dependencies & Execution Order

- Phase 2 product feature: requires 004–007 and 005 process protocol. T002 spike gates T011.

## Parallel Example

```bash
Task: "T005 host tests"  Task: "T010 restart tests"
```

## Implementation Strategy

MVP = US1 + US2.
