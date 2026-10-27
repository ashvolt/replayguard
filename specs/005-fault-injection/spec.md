# Feature Specification: Fault Injection Strategies

**Feature Branch**: `005-fault-injection`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Simulate timeouts and crashes around external calls: crash after the provider succeeded but before the workflow saved progress, lose the provider's response, make the provider hang past a step timeout, and kill the real process. Three crash mechanisms (persistence crash, throw after call, real process kill) behind one interface."

## Clarifications

### Session 2026-10-28

- Q: How to simulate crashes? → A: All three strategies behind one interface: persistence crash
  (storage stops accepting writes), throw-after-call (lost response), real process kill.
- Q: Durable storage for process kill? → A: A file-backed implementation of the engine's public
  storage interface, shared between the killed process and its restart.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crash right after the provider succeeded (Priority: P1)

A developer declares "crash after the first successful payment" and the simulated host dies at
exactly that moment: the provider has applied the charge, but nothing the workflow does afterwards
is saved. The workflow is then restarted from its durable state.

**Why this priority**: This is the headline scenario (spike H1/H2) that produces duplicate charges.

**Independent Test**: With one instrumented payment step and this fault, restart once and observe
two applied payment attempts.

**Acceptance Scenarios**:

1. **Given** a fault anchored "after effect `payment`, occurrence 1", **When** the payment attempt
   is applied, **Then** all further durable writes fail, the current run terminates, and a fault
   event is recorded with the in-flight attempts.
2. **Given** the crashed run, **When** the host restarts, **Then** durable state contains only what
   was persisted before the crash.
3. **Given** a fault anchored to "durable write number N", **When** the Nth write is attempted,
   **Then** the crash happens before that write is stored.

---

### User Story 2 - Lose the provider's response (Priority: P1)

A developer simulates a network failure after the provider processed a request: the effect is
applied but the caller receives an error, so the workflow's retry logic kicks in.

**Why this priority**: The most common real-world duplicate cause; independent of process crashes.

**Independent Test**: Fault "throw after effect `email`"; the step retries and the ledger shows two
applied email attempts.

**Acceptance Scenarios**:

1. **Given** a throw-after fault on effect `email` occurrence 1, **When** the email attempt is
   applied, **Then** the caller receives a simulated network error and the attempt stays `applied`.
2. **Given** the same fault with a custom error factory, **When** triggered, **Then** the custom
   error is thrown (e.g. to emulate a specific provider timeout error).

---

### User Story 3 - Provider hangs past the step timeout (Priority: P1)

A developer simulates a provider that responds slowly so the workflow step times out while the
call is still in flight, revealing concurrent duplicates and orphaned charges (spike H3).

**Why this priority**: Timeouts are explicitly in scope and produce distinct outcome classes.

**Independent Test**: Fault "delay effect `payment` occurrence 1 by 500 ms" with a 50 ms step
timeout; the ledger shows the original attempt completing after the timeout.

**Acceptance Scenarios**:

1. **Given** a delay fault of D ms on an effect, **When** the step's timeout T < D elapses, **Then**
   the attempt keeps running and its completion is recorded after the timeout.
2. **Given** the delay fault on occurrence 1 only, **When** the retry calls the effect again,
   **Then** the retry is not delayed.

---

### User Story 4 - Kill the real process (Priority: P2)

A developer wants maximum realism: the workflow runs in a separate process that is forcibly
terminated at the fault point and restarted on the same durable storage file.

**Why this priority**: Validates that in-process simulation matches real crash behavior; slower.

**Independent Test**: Run the payment scenario with process kill; results match the in-process
crash strategy's outcome.

**Acceptance Scenarios**:

1. **Given** a process-kill fault after effect `payment`, **When** the child process reports the
   effect applied, **Then** the parent terminates it immediately and starts a fresh child on the
   same durable storage.
2. **Given** a child process that never reaches the anchor, **When** it exits normally, **Then** no
   kill occurs and the run is reported as fault-not-triggered.
3. **Given** a child that hangs beyond a configured limit, **When** the limit is reached, **Then**
   it is terminated and the case is reported as a harness timeout, not as a workflow result.

---

### User Story 5 - No-fault baseline (Priority: P2)

A developer runs the workflow with no faults to establish the expected set of effects.

**Why this priority**: Required for "skipped" detection and automatic fault discovery (006).

**Independent Test**: Run with the no-fault strategy; ledger shows each effect once and no fault
events.

**Acceptance Scenarios**:

1. **Given** the no-fault strategy, **When** a scenario runs, **Then** no fault events are recorded
   and behavior equals an uninstrumented run.

### Edge Cases

- Anchor occurrence never reached (effect called fewer times) → case marked `fault-not-triggered`.
- Fault anchored to an effect that fails on its own before applying → fault not triggered for
  "after" points; recorded as such.
- Multiple faults in one case (e.g. crash twice) → supported as an ordered list; each fires once.
- Process kill on Windows (no POSIX signals) → forced termination supported on all three OSes.
- Durable storage file locked or corrupted after kill → restart fails with a clear harness error.
- Fault signal swallowed by user code (catch-all in step) → crash still effective because storage
  rejects all writes; documented.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single fault strategy abstraction with implementations:
  `none`, `crash` (persistence stops), `throwAfter` (lost response), `delay` (provider hang), and
  `processKill`.
- **FR-002**: Faults MUST be anchored to an effect (kind or logical identity + occurrence) at a
  point (`before`, `after`), or to a durable write index.
- **FR-003**: The `crash` strategy MUST make every subsequent durable write fail for the current
  run and allow a restart that reads only previously persisted state.
- **FR-004**: The `throwAfter` strategy MUST let the effect apply and then throw a configurable
  error to the caller.
- **FR-005**: The `delay` strategy MUST hold the effect for a configurable duration without
  cancelling it, for the targeted occurrence only.
- **FR-006**: The `processKill` strategy MUST run the workflow in a child process using file-backed
  durable storage, forcibly terminate it at the anchor, and restart it; it MUST work on Linux,
  Windows and macOS.
- **FR-007**: The child process MUST only be launched from a user-specified entry module with a
  fixed argument set and without a shell.
- **FR-008**: Every triggered fault MUST be recorded in the effect ledger with time, run index,
  anchor and in-flight attempts; untriggered faults MUST be reported as such.
- **FR-009**: Persistence faults MUST be implemented by wrapping the storage the engine is given,
  never by modifying the engine.
- **FR-010**: The file-backed durable storage MUST implement the engine's public storage contract
  and pass the same behavioral tests as the in-memory storage.
- **FR-011**: Each strategy MUST be deterministic for a given scenario and seed.
- **FR-012**: In process-kill mode, effect attempts made in the child MUST be relayed to the
  parent's ledger as they happen, so attempts applied immediately before the kill are never lost;
  the relay channel MUST carry only ledger events (no code or functions).

### Key Entities

- **FaultStrategy**: named mechanism that arms on an anchor and fires once.
- **FaultSpec**: strategy + anchor + point + options (error factory, delay, limits).
- **FaultAnchor**: effect selector + occurrence, or durable write index.
- **FaultOutcome**: triggered/not-triggered, time, run index.
- **DurableStore**: storage the engine persists into (in-memory or file-backed), wrappable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All spike F0 behaviors (H1–H4) are reproducible using only the public fault API.
- **SC-002**: In-process crash and process-kill strategies yield the same outcome classification
  for the same scenario in 100% of the reference scenarios.
- **SC-003**: An in-process fault case completes in under 200 ms; a process-kill case in under 3 s.
- **SC-004**: Zero modifications to engine code or prototypes (verified by review and tests).

## Assumptions

- Engine version: `@rivet-dev/workflows` 1.x public API (`runWorkflow`, `EngineDriver`,
  `InMemoryDriver`).
- Process kill uses the platform's forced termination; graceful shutdown hooks are intentionally
  not run (that is the point of a crash).
- Timeout simulation relies on the step's own timeout configuration; ReplayGuard does not change
  engine timeouts.
