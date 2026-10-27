# Feature Specification: Idempotency Key Helper & Fix Hints

**Feature Branch**: `011-idempotency-helper`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Report + key helper: ship an idempotencyKey(ctx, step, iteration) helper and suggest fixes in the report. Spike F0 showed the attempt counter resets after a crash, so keys must never depend on attempt numbers."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stable idempotency key for a step (Priority: P1)

A developer passes `idempotencyKey(ctx, 'charge')` to their payment provider so that re-executions
of the step after crashes, retries or timeouts produce the same key and the provider dedups.

**Why this priority**: The primary fix for duplicated outcomes (spike H1b).

**Independent Test**: Run the crash-after-payment scenario with the helper; outcome changes from
`duplicated` to `deduplicated`.

**Acceptance Scenarios**:

1. **Given** a workflow ID `wf-1` and step `charge`, **When** the key is generated in the first run
   and again after a restart, **Then** both keys are identical.
2. **Given** two different workflows, **When** keys are generated for the same step name, **Then**
   keys differ.
3. **Given** a step inside a durable loop at iteration 3, **When** the key is generated with the
   iteration, **Then** it differs from iteration 2 and is stable across restarts.
4. **Given** a namespace option (e.g. `"payments"`), **When** generated, **Then** the key includes
   it so different providers don't collide.

---

### User Story 2 - Fix hints in reports (Priority: P1)

A developer whose test fails sees a concrete suggested fix next to each violation, chosen from
the outcome, the fault and the effect's configuration.

**Why this priority**: Turns detection into resolution.

**Independent Test**: A duplicated payment without an idempotency key yields the hint to use the
key helper; a concurrent-duplicate yields the hint about timeouts and abort signals.

**Acceptance Scenarios**:

1. **Given** `duplicated` with no idempotency key recorded, **When** hints are computed, **Then**
   the hint recommends passing a stable idempotency key and shows a code snippet.
2. **Given** `concurrent-duplicate` caused by a delay fault with retry on timeout, **When** hints
   are computed, **Then** the hint recommends an idempotency key and propagating cancellation,
   and warns that retrying on timeout re-sends while the first call may still succeed.
3. **Given** `orphaned` after a non-retryable timeout, **When** hints are computed, **Then** the
   hint recommends compensation (rollback) or making the step retryable with an idempotency key.
4. **Given** `duplicated` despite a key being recorded, **When** hints are computed, **Then** the
   hint states the provider did not deduplicate and suggests verifying provider-side support or
   key stability (e.g. key includes attempt number or timestamp).
5. **Given** `skipped`, **When** hints are computed, **Then** the hint points at ephemeral steps or
   swallowed errors.

---

### User Story 3 - Detect unstable keys (Priority: P2)

A developer accidentally builds keys from timestamps or random values; ReplayGuard flags that the
same logical effect used different keys across re-executions.

**Why this priority**: A common mistake that silently defeats idempotency.

**Independent Test**: A key built from `Date.now()` produces an "unstable key" hint.

**Acceptance Scenarios**:

1. **Given** two attempts of the same logical effect with different idempotency keys, **When**
   classified, **Then** an `unstable-idempotency-key` hint is attached.

### Edge Cases

- Workflow ID or step name containing separator characters → components are escaped so keys are
  unambiguous.
- Keys exceeding common provider limits (255 chars) → hashed to a fixed length with a readable
  prefix.
- Helper called outside a workflow context (no ID) → configuration error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The helper MUST derive keys only from workflow ID, step name, optional iteration,
  optional namespace and optional user parts — never attempt numbers, time or randomness.
- **FR-002**: Keys MUST be deterministic, unambiguous (escaped components) and at most 255
  characters (hash fallback).
- **FR-003**: The helper MUST accept any context object exposing a workflow ID.
- **FR-004**: The system MUST attach a fix hint to every non-passing outcome based on outcome,
  fault type, presence and stability of idempotency keys, and step configuration when known.
- **FR-005**: Hints MUST include a short title, explanation and a code example.
- **FR-006**: The system MUST detect differing idempotency keys for the same logical effect.
- **FR-007**: Hint rules MUST be data-driven and independently testable.

### Key Entities

- **IdempotencyKeyParts**: workflow ID, step, iteration, namespace, extra parts.
- **FixHint**: ID, title, explanation, example, applies-to outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Applying the suggested fix turns the spike H1 scenario from fail to pass with no
  other changes.
- **SC-002**: 100% of non-passing outcomes carry at least one hint.
- **SC-003**: Key generation is stable across 1,000 restarts in property tests.

## Assumptions

- Providers accept string idempotency keys up to 255 characters.
- Step configuration (timeout, retryOnTimeout, ephemeral) is available to hints only when the
  adapter can observe it; otherwise hints are phrased conditionally.
