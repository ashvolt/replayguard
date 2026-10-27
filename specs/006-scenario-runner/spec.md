# Feature Specification: Scenario Runner & Fault Matrix

**Feature Branch**: `006-scenario-runner`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Developers describe a workflow, its instrumented side effects and optional faults, and ReplayGuard runs it: a clean baseline run, then one run per fault case — automatically enumerating every fault point around every effect within a budget — restarting after crashes and waiting out retries like a real host, and producing raw results for classification."

## Clarifications

### Session 2026-10-28

- Q: How are fault points chosen? → A: Automatic matrix (every effect occurrence × every fault
  point × enabled strategies) within a budget, plus explicit user-pinned fault cases.
- Q: Which runtime first? → A: The `@rivet-dev/workflows` engine (in-process), with the RivetKit
  actor runtime added later behind the same runtime port.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run one explicit fault scenario (Priority: P1)

A developer writes a test: "run my checkout workflow, crash after the payment succeeds, restart,
and give me the results". The runner executes the workflow, injects the fault, restarts the
workflow from durable state until it completes or fails, and returns a structured run result.

**Why this priority**: Smallest end-to-end slice; with classification (007) it is the MVP.

**Independent Test**: Spike H1 expressed through the runner returns a result with 2 applied
payment attempts, 1 restart and final state `completed`.

**Acceptance Scenarios**:

1. **Given** a scenario with one explicit fault case, **When** run, **Then** the result contains
   the baseline case and the fault case, each with the ledger snapshot, number of runs, number of
   restarts, the fault outcome, and the final workflow state.
2. **Given** a step that schedules a retry with backoff, **When** the run yields, **Then** the
   runner waits until the retry time and resumes, like a real host.
3. **Given** a workflow that never settles, **When** the per-case time or run budget is exceeded,
   **Then** the case ends with status `budget-exceeded` instead of hanging.

---

### User Story 2 - Automatically explore all fault points (Priority: P1)

A developer does not know where the dangerous gaps are. They ask the runner to explore: it
discovers every effect occurrence during the baseline and generates a fault case for each
occurrence × point × enabled strategy, within a case budget.

**Why this priority**: Finds bugs users did not think of; the product's differentiator.

**Independent Test**: A workflow with 2 effects and strategies {crash, throwAfter} generates
2 × 2 × 2 = 8 cases (before/after points), all executed.

**Acceptance Scenarios**:

1. **Given** a baseline with effects `email`(1), `payment`(1), **When** exploration runs with
   strategies `crash` and `throwAfter` and points `before`, `after`, **Then** 8 fault cases are
   generated in a deterministic order and executed.
2. **Given** a case budget of 5 and 8 candidate cases, **When** exploration runs, **Then** 5 cases
   run in a deterministic priority order (after-points first, crash before throwAfter) and the
   result lists the 3 skipped candidates.
3. **Given** explicit cases plus exploration, **When** run, **Then** explicit cases always run and
   duplicates of explicit cases are not generated again.

---

### User Story 3 - Fluent, validated scenario definition (Priority: P2)

A developer builds scenarios with a readable chained API and gets immediate, specific errors for
invalid combinations.

**Why this priority**: Developer experience; correctness is covered by stories 1–2.

**Independent Test**: Building a scenario without a workflow throws a configuration error naming
the missing part.

**Acceptance Scenarios**:

1. **Given** a builder missing the workflow, **When** `build()` is called, **Then** a configuration
   error states that a workflow is required.
2. **Given** a `processKill` strategy without an entry module, **When** built, **Then** a
   configuration error states that an entry module is required.

---

### User Story 4 - Isolated, repeatable cases (Priority: P2)

Each case starts from fresh durable storage and fresh fake-provider state, so one case cannot
contaminate another, and re-running a scenario gives identical classifications.

**Why this priority**: Determinism principle; flaky verdicts destroy trust.

**Independent Test**: Run the same scenario twice; results (excluding timestamps) are equal.

**Acceptance Scenarios**:

1. **Given** two cases in one scenario, **When** executed, **Then** each uses newly created storage
   and providers produced by user-supplied factories.
2. **Given** a seed, **When** the scenario is re-run, **Then** case order and outcomes are identical.

### Edge Cases

- Workflow waiting for an external message → case settles as `waiting` (not an error) unless the
  scenario supplies messages to deliver.
- Workflow throws a non-crash error during baseline → baseline reported as failed; exploration
  still runs but results are flagged "baseline not clean".
- Effects inside parallel branches (join/race) → occurrence numbering follows start order, ties
  broken by sequence number.
- Late completions (provider finishing after the workflow settled) → runner waits a configurable
  grace period before snapshotting the ledger.
- Retry backoff longer than the case time budget → `budget-exceeded`, with a hint to lower backoff
  in tests.
- Case factory throws → case reported as harness error; remaining cases continue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The runner MUST execute a fixed lifecycle per case: prepare fresh context → arm
  faults → run → on crash restart from durable state → wait for scheduled retries → settle →
  grace period → snapshot.
- **FR-002**: The runner MUST always execute a no-fault baseline case first.
- **FR-003**: The runner MUST support explicit fault cases and automatic exploration of
  effect occurrence × point × strategy, deduplicated against explicit cases.
- **FR-004**: Exploration MUST respect a case budget with deterministic prioritization and report
  skipped candidates.
- **FR-005**: Each case MUST enforce a run budget (max restarts) and a time budget; exceeding
  either yields `budget-exceeded`.
- **FR-006**: Each case MUST use fresh durable storage and fresh effect providers created by
  user-supplied factories.
- **FR-007**: Results MUST include per case: fault spec, fault outcome, final workflow state,
  output or error, runs, restarts, durations, and ledger snapshot.
- **FR-008**: The runner MUST talk to workflow runtimes only through a runtime port; the first
  adapter targets the `@rivet-dev/workflows` engine.
- **FR-009**: The scenario definition API MUST validate configuration at build time with typed
  errors.
- **FR-010**: The runner MUST be usable from any test framework (no test-framework dependency).
- **FR-011**: A seed MUST control any randomized ordering; identical seed ⇒ identical case order.
- **FR-012**: Harness errors (factory failure, child process failure) MUST be distinguished from
  workflow outcomes.

### Key Entities

- **Scenario**: workflow, input, effect factories, fault cases, exploration options, budgets, seed.
- **FaultCase**: one fault list applied to one execution.
- **CaseResult**: execution record of one case.
- **ScenarioResult**: baseline + case results + skipped candidates + metadata.
- **WorkflowRuntime (port)**: start/resume a workflow on given durable storage, report state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can write a crash-after-payment test in under 15 lines.
- **SC-002**: Exploration of a 5-effect workflow with 2 strategies × 2 points (20 cases) completes
  in under 5 seconds with in-process strategies and test-sized backoff.
- **SC-003**: Re-running a scenario with the same seed yields identical classifications 100% of
  the time across 100 repetitions.
- **SC-004**: No case can hang a test suite: 100% of cases terminate within their time budget plus
  grace period.

## Assumptions

- The engine reads real wall-clock time for retries and sleeps; the runner waits in real time, so
  users keep retry backoff small in tests (documented).
- One workflow per scenario; multi-workflow interactions are out of scope for v1.
- Cases run sequentially within a scenario (determinism and fake isolation); users can run
  scenarios in parallel through their test framework.
- Effects are triggered only from within workflow steps.
