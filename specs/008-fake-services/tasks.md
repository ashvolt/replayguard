---

description: "Task list for 008-fake-services"
---

# Tasks: Fake External Services

**Input**: Design documents from `/specs/008-fake-services/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (test-first).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Add `@replayguard/core` workspace dependency and exports map in packages/fakes/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T002 [P] Write failing IdempotencyStore tests (replay same fingerprint, conflict on different fingerprint, in-flight conflict vs wait) incl. fast-check (N same-key calls ⇒ 1 execution) in packages/fakes/test/idempotency-store.test.ts
- [ ] T003 Implement IdempotencyStore and errors (`RG_FAKE_IDEMPOTENCY_CONFLICT`, `RG_FAKE_IDEMPOTENCY_IN_FLIGHT`) in packages/fakes/src/idempotency-store.ts
- [ ] T004 [P] Write failing `recordable()` tests (uses ctx.instrument when ctx given, plain call otherwise, latency via sleeper inside the recorded call, failure script first N calls) in packages/fakes/test/recordable.test.ts
- [ ] T005 Implement `recordable()` and FailureScript handling in packages/fakes/src/recordable.ts

---

## Phase 3: User Story 1 - Fake payment provider (Priority: P1) 🎯 MVP

**Goal**: Charges with idempotency, conflicts, latency.

**Independent Test**: Same key twice → 1 charge, second `replayed: true`, ledger dedup.

- [ ] T006 [P] [US1] Write failing payment tests ("amount integer > 0", currency default "usd", sequential ids "ch_000001", idempotency on/off, key reuse conflict, refund, read-only `charges`) in packages/fakes/test/payment.test.ts
- [ ] T007 [US1] Implement `createFakePayment` (kinds `payment.charge`, `payment.refund`) in packages/fakes/src/payment.ts

---

## Phase 4: User Story 2 - Fake email sender (Priority: P1)

**Goal**: Outbox without dedup.

**Independent Test**: Lost-response fault → 2 messages.

- [ ] T008 [P] [US2] Write failing email tests (outbox, no dedup, custom subject) in packages/fakes/test/email.test.ts
- [ ] T009 [US2] Implement `createFakeEmail` (kind `email.send`) in packages/fakes/src/email.ts

---

## Phase 5: User Story 3 - Generic HTTP/API fake (Priority: P2)

**Goal**: Routes, statuses, idempotency header.

**Independent Test**: Same `Idempotency-Key` twice → second replayed; unknown route → 404 failed.

- [ ] T010 [P] [US3] Write failing HTTP fake tests in packages/fakes/test/http.test.ts
- [ ] T011 [US3] Implement `createFakeHttp` (kind `http:<METHOD> <path>`) in packages/fakes/src/http.ts

---

## Phase 6: User Story 4 - Webhook receiver (Priority: P3)

**Goal**: Dedup by event id, scripted failures.

**Independent Test**: Same event twice with dedup → processed once.

- [ ] T012 [P] [US4] Write failing webhook receiver tests in packages/fakes/test/webhook.test.ts
- [ ] T013 [US4] Implement `createFakeWebhookReceiver` (kind `webhook.deliver`) in packages/fakes/src/webhook.ts

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T014 Write example scenarios reproducing every outcome class with the fakes in packages/fakes/test/outcomes.examples.test.ts
- [ ] T015 [P] Docs page per fake in docs/fakes/README.md
- [ ] T016 Author diagrams covering T001–T017 in specs/008-fake-services/diagram.yaml
- [ ] T017 Validate quickstart scenarios in specs/008-fake-services/quickstart.md

## Dependencies & Execution Order

- Requires 004 (instrument, canonicalHash) and 006 (EffectContext); T014 requires 006 + 007.
- Foundational → US1/US2 (parallel) → US3 → US4 → Polish.

## Parallel Example

```bash
Task: "T006 payment tests"  Task: "T008 email tests"  Task: "T010 http tests"  Task: "T012 webhook tests"
```

## Implementation Strategy

MVP = payment + email.
