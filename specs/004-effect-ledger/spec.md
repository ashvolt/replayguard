# Feature Specification: Effect Ledger & Instrumentation

**Feature Branch**: `004-effect-ledger`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Record every external side effect (payment, email, API call) a workflow attempts during a simulation — when it started, finished, whether the provider applied or deduplicated it — so later stages can tell whether an action was repeated, skipped or safely deduplicated. Users connect their own clients through an instrument() wrapper; built-in fakes use the same ledger."

## Clarifications

### Session 2026-10-28

- Q: How do users connect real side effects? → A: Built-in fakes plus `instrument(fn, options)`
  wrapping any user function; no global network interception.
- Q: How are attempts of the "same" effect grouped across retries and restarts? → A: By logical
  effect identity = effect kind + subject; subject defaults to a stable hash of call arguments and
  can be overridden by a user-supplied function.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instrument my own side-effect function (Priority: P1)

A developer wraps their existing `chargeCard(orderId, amount)` function so every call made by the
workflow under test is recorded with timing, outcome and logical identity, without changing the
function's behavior or return value.

**Why this priority**: Without recorded effects nothing can be classified; this is the foundation.

**Independent Test**: Wrap a function, call it three times with two distinct argument sets, and
inspect the ledger: three attempts grouped into two logical effects.

**Acceptance Scenarios**:

1. **Given** an instrumented function, **When** it is called and resolves, **Then** the ledger
   contains one attempt with start time, end time, status `applied`, kind and subject, and the
   caller receives the original return value.
2. **Given** an instrumented function that throws, **When** called, **Then** the attempt is
   recorded with status `failed` and the original error is rethrown unchanged.
3. **Given** two calls with identical arguments, **When** recorded, **Then** both attempts share
   the same logical effect identity.
4. **Given** a custom subject function `(orderId) => orderId`, **When** calls differ only in
   amount, **Then** they share the same logical identity.

---

### User Story 2 - Record provider-side deduplication (Priority: P1)

A provider (real or fake) that honors idempotency keys reports that a call was a replay of an
earlier one; the ledger marks that attempt as `deduplicated` so it is not counted as a new effect.

**Why this priority**: Distinguishing "repeated" from "safely deduplicated" is the product's core
promise.

**Independent Test**: Record two attempts with the same idempotency key where the second reports
dedup; the ledger shows one applied and one deduplicated.

**Acceptance Scenarios**:

1. **Given** an instrumented function configured with an idempotency key extractor and a dedup
   detector, **When** the provider response indicates a replay, **Then** the attempt is recorded as
   `deduplicated` with the key.
2. **Given** no idempotency key, **When** the same logical effect is applied twice, **Then** both
   attempts are `applied`.

---

### User Story 3 - Observe in-flight effects at the moment of a fault (Priority: P1)

The simulator must know which effects were still running when a crash or timeout happened, and
whether they completed afterwards.

**Why this priority**: Spike H3 showed timed-out calls keep running and complete later; this is
needed to detect concurrent duplicates and orphans.

**Independent Test**: Start a slow attempt, mark a fault, let the attempt complete; the attempt
shows it was in flight at the fault and its later completion time.

**Acceptance Scenarios**:

1. **Given** an attempt in progress, **When** a fault is recorded, **Then** the attempt is flagged
   `inFlightAtFault` with the fault ID.
2. **Given** an attempt that completes after the run was declared settled, **When** the ledger is
   finalized after a grace period, **Then** its completion is still recorded.
3. **Given** two attempts of the same logical effect whose time intervals overlap, **When**
   queried, **Then** the ledger reports them as overlapping.

---

### User Story 4 - Subscribe to effects as they happen (Priority: P2)

Fault strategies need to react the instant an effect is applied (e.g. "crash right after the
payment succeeds").

**Why this priority**: Required by fault injection, but the ledger is useful standalone first.

**Independent Test**: Subscribe a listener; it receives `started`, `applied` events synchronously
in order.

**Acceptance Scenarios**:

1. **Given** a listener, **When** an attempt starts and is applied, **Then** the listener receives
   `started` then `settled` events before the instrumented call returns to its caller.
2. **Given** a listener that throws a designated fault signal, **When** an effect is applied,
   **Then** the signal propagates to the caller (so a crash can be simulated at that point) and
   the attempt itself remains recorded as applied.

### Edge Cases

- Arguments that cannot be hashed stably (functions, cycles, bigint, symbols) → subject hashing
  uses a canonical serializer; unsupported values require a custom subject function, otherwise an
  explicit configuration error is raised on first call.
- Instrumented function returning non-promise values → supported (wrapped as resolved).
- Same ledger used across multiple restarts within a scenario → attempts carry the run index.
- Very large argument payloads → only the hash and a truncated preview are stored.
- Sensitive arguments (card numbers, emails) → previews are opt-in and redactable; default stores
  no raw argument values.
- Concurrent attempts started in the same millisecond → ordering preserved by a monotonic sequence
  number, not timestamps.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an instrument operation that wraps any function and records
  each invocation as an attempt without altering arguments, return values or thrown errors.
- **FR-002**: Each attempt MUST record: sequence number, run index, effect kind, subject, logical
  identity, optional idempotency key, start time, end time, status (`started`, `applied`,
  `deduplicated`, `failed`), and fault flags.
- **FR-003**: Logical identity MUST default to kind + canonical hash of arguments, overridable per
  instrumented function.
- **FR-004**: The system MUST support an optional idempotency key extractor and a dedup detector
  per instrumented function.
- **FR-005**: The ledger MUST notify subscribers synchronously on attempt start and settle, in
  order, before control returns to the caller.
- **FR-006**: The ledger MUST allow recording fault events and flag in-flight attempts at that
  moment.
- **FR-007**: The ledger MUST continue recording completions after settlement until explicitly
  finalized, and support a grace period to capture late completions.
- **FR-008**: The ledger MUST expose queries: attempts by logical identity, overlapping attempts,
  applied count, deduplicated count.
- **FR-009**: Time and sequence MUST come from injectable sources so tests are deterministic.
- **FR-010**: By default the ledger MUST NOT store raw argument values; an opt-in preview with a
  redaction function MAY be configured.
- **FR-011**: The ledger snapshot MUST be serializable to plain data.

### Key Entities

- **EffectAttempt**: one invocation of an instrumented function.
- **LogicalEffect**: grouping of attempts that represent the same intended real-world action.
- **FaultEvent**: point in time and run at which a fault was injected.
- **EffectLedger**: ordered store of attempts and fault events with subscriptions and queries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Wrapping a function requires one line of code and no change to its call sites inside
  the workflow beyond using the wrapped reference.
- **SC-002**: 100% of attempts made during a simulation appear in the ledger, including those
  completing after a fault.
- **SC-003**: Instrumentation overhead below 1 ms per call.
- **SC-004**: Zero raw argument values stored unless the user opts in.

## Assumptions

- Effects are invoked from JavaScript/TypeScript code within the same process as the ledger
  (process-kill scenarios relay events across processes, covered in feature 005).
- Arguments for the same intended action are identical across retries in typical workflows;
  where not (e.g. timestamps in args), users supply a subject function.
