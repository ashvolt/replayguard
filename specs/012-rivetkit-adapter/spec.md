# Feature Specification: RivetKit Actor Adapter

**Feature Branch**: `012-rivetkit-adapter`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Engine first, actor later: add an adapter so ReplayGuard scenarios can run real RivetKit workflow actors (workflow() definitions from @rivet-dev/workflows registered in a RivetKit registry), including actor sleep/restart, with the same fault, classification and reporting pipeline."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a scenario against a workflow actor (Priority: P1)

A developer who defines workflows with `workflow({ state, run, actions })` points ReplayGuard at
the actor definition and runs the same scenarios as at the engine level.

**Why this priority**: Most Rivet users write actors, not raw engine workflows.

**Independent Test**: The crash-after-payment scenario against a workflow actor produces the same
outcome as the engine-level adapter.

**Acceptance Scenarios**:

1. **Given** a workflow actor definition and a scenario, **When** run via the actor adapter,
   **Then** baseline and fault cases execute and results classify identically to the engine
   adapter for the same workflow logic.
2. **Given** instrumented effects called inside actor workflow steps, **When** run, **Then** all
   attempts are recorded in the ledger.

---

### User Story 2 - Actor crash and restart (Priority: P1)

A developer simulates the actor's host crashing at the fault point and the actor being restored
from its persisted state.

**Why this priority**: Actor-level persistence differs from the bare engine; must be validated.

**Independent Test**: Process-kill strategy on an actor scenario restarts the actor and resumes the
workflow.

**Acceptance Scenarios**:

1. **Given** a crash fault after an effect, **When** triggered, **Then** the actor's host stops,
   restarts on the same storage, and the workflow resumes from persisted history.
2. **Given** an actor sleeping during a retry backoff, **When** the backoff elapses, **Then** the
   adapter wakes it and the case continues.

---

### User Story 3 - Version compatibility (Priority: P2)

A maintainer verifies the adapter against each supported RivetKit/workflows version range.

**Why this priority**: Rivet evolves quickly; compatibility must be continuously checked.

**Independent Test**: CI matrix runs the adapter suite against declared peer versions.

**Acceptance Scenarios**:

1. **Given** the supported version matrix, **When** CI runs, **Then** each version passes the
   adapter's conformance suite (same suite as engine adapter).

### Edge Cases

- Actor state mutations in failed attempts persist (roll-forward semantics) → reported, not
  treated as effects unless instrumented.
- Actor requires the Rivet engine binary → adapter starts it locally for tests with a free port
  and a temp storage directory, cleaned up afterwards.
- Engine binary unavailable on a platform → adapter tests skipped with an explicit message,
  never silently passing.
- Port conflicts → retried with another free port.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The adapter MUST implement the same runtime port as the engine adapter.
- **FR-002**: The adapter MUST run workflow actors using only public RivetKit and workflows APIs.
- **FR-003**: The adapter MUST support crash/restart of the actor host on persistent storage and
  resume the workflow.
- **FR-004**: The adapter MUST pass a shared runtime conformance suite used by all adapters.
- **FR-005**: The adapter MUST clean up processes, ports and temp storage after each case.
- **FR-006**: Supported versions MUST be declared as peer ranges and tested in CI.

### Key Entities

- **ActorRuntime**: runtime port implementation for workflow actors.
- **ActorHost**: local engine + registry instance with temp storage.
- **ConformanceSuite**: shared behavioral tests all runtime adapters must pass.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% agreement between engine-level and actor-level classifications on the
  reference scenarios.
- **SC-002**: An actor-level fault case completes in under 5 seconds.
- **SC-003**: Zero leaked processes or temp directories after the test suite.

## Assumptions

- Phase 2 feature; depends on features 004–007.
- Local engine startup via RivetKit's documented `startEngine` setup option, as used in the
  workflows repository's own end-to-end test.
