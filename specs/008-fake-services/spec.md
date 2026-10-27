# Feature Specification: Fake External Services

**Feature Branch**: `008-fake-services`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Mock world for v1: payment charge (supports idempotency keys, can time out after charging), email send (no idempotency — the classic duplicate), generic HTTP/API endpoint (configurable latency, timeout, success-then-lost-response), and webhook delivery (receiver dedups by webhook-id, mirroring Rivet's webhook guide)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fake payment provider (Priority: P1)

A developer replaces their payment client with a fake that records charges in the ledger, holds
an in-memory account of charges, and optionally honors idempotency keys like real providers.

**Why this priority**: Payments are the headline duplicate-risk example.

**Independent Test**: Charge twice with the same key with idempotency enabled → one charge in the
provider's state, second attempt recorded as deduplicated.

**Acceptance Scenarios**:

1. **Given** a fake payment with idempotency enabled, **When** `charge` is called twice with the
   same key, **Then** the provider holds one charge and returns the original charge ID both times.
2. **Given** idempotency disabled, **When** charged twice, **Then** two charges exist.
3. **Given** a charge with a key reused with a different amount, **When** called, **Then** the
   provider rejects it with an idempotency-conflict error (like real providers).
4. **Given** the provider is configured with latency, **When** charged, **Then** the call resolves
   after that latency (respecting the injected clock in tests).

---

### User Story 2 - Fake email sender (Priority: P1)

A developer swaps their mailer for a fake that records every sent message and never dedups,
showing the classic duplicate email problem.

**Why this priority**: Simplest, most common duplicate; good first demo.

**Independent Test**: Send with a lost-response fault → two messages in the outbox.

**Acceptance Scenarios**:

1. **Given** the fake email sender, **When** `send` is called twice with the same message, **Then**
   the outbox contains two messages and both attempts are applied.
2. **Given** a user-supplied subject function `(msg) => msg.to + msg.template`, **When** sends
   differ only in timestamp text, **Then** they share one logical identity.

---

### User Story 3 - Generic HTTP/API fake (Priority: P2)

A developer simulating a third-party REST API configures routes with responses, latency and
idempotency-key header support.

**Why this priority**: Covers everything not modelled explicitly.

**Independent Test**: Configure `POST /orders` with `Idempotency-Key` support; repeated requests
with the same key return the same response and record dedup.

**Acceptance Scenarios**:

1. **Given** a route configured with status 201 and a body, **When** requested, **Then** the fake
   returns that response and records the attempt with kind `http:POST /orders`.
2. **Given** idempotency header support, **When** two requests carry the same key, **Then** the
   second is deduplicated.
3. **Given** a request to an unconfigured route, **When** called, **Then** it returns 404 and is
   recorded as failed.

---

### User Story 4 - Webhook delivery and receiving endpoint (Priority: P3)

A developer testing an outbound webhook workflow uses a fake receiving endpoint that dedups by
`webhook-id`, as Rivet's webhook guide instructs receivers to do.

**Why this priority**: Mirrors an official Rivet guide; demonstrates receiver-side dedup.

**Independent Test**: Deliver the same event twice → receiver processed once, second attempt
recorded as deduplicated; with dedup disabled → processed twice.

**Acceptance Scenarios**:

1. **Given** a receiver with dedup enabled, **When** the same `webhook-id` is delivered twice,
   **Then** it is processed once and the second delivery is acknowledged but deduplicated.
2. **Given** a receiver configured to fail the first N deliveries, **When** delivered, **Then** it
   returns an error status N times and then succeeds.

### Edge Cases

- Fakes created per case via factories; state never leaks between cases.
- Fakes used without a ledger (plain unit tests) → work normally, nothing recorded.
- Concurrent calls with the same idempotency key while the first is still in flight → second
  waits and returns the same result (like Stripe's in-progress lock) or returns a conflict,
  configurable; default: conflict error.
- Fakes expose read-only views of their state for assertions; no mutation from outside.
- Fakes never perform real network or file I/O.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide factory functions for payment, email, HTTP and webhook
  receiver fakes with safe defaults.
- **FR-002**: Every fake operation MUST be recorded through the same instrumentation as user
  functions, with a fixed effect kind per fake operation.
- **FR-003**: The payment fake MUST support idempotency keys (enable/disable), key-reuse conflict
  detection, configurable latency and failure modes.
- **FR-004**: The email fake MUST record messages without deduplication and support a custom
  subject function.
- **FR-005**: The HTTP fake MUST support route definitions with method, path, status, body,
  latency, and optional idempotency-key header handling.
- **FR-006**: The webhook receiver fake MUST support dedup by event ID (on/off) and scripted
  failures for the first N deliveries.
- **FR-007**: Each fake MUST expose read-only state for assertions (charges, outbox, requests,
  processed events).
- **FR-008**: Fakes MUST use injected time sources for latency.
- **FR-009**: Fakes MUST work without a ledger.
- **FR-010**: Fakes MUST perform no real I/O.

### Key Entities

- **FakePayment**: charges ledger, idempotency index.
- **FakeEmail**: outbox.
- **FakeHttp**: routes, request log, idempotency index.
- **FakeWebhookReceiver**: processed event IDs, delivery log, failure script.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each fake can be set up in one line with defaults.
- **SC-002**: The four fakes reproduce each spike F0 outcome class at least once in the example
  suite.
- **SC-003**: 100% of fake operations appear in the ledger when a ledger is attached.

## Assumptions

- Fake semantics follow widely documented provider behavior (e.g. idempotency key replay returns
  the original result; reuse with different parameters is a conflict).
- Fakes are test doubles; they do not aim to emulate full provider APIs.
