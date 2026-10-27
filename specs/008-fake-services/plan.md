# Implementation Plan: Fake External Services

**Branch**: `008-fake-services` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-fake-services/spec.md`

## Summary

`@replayguard/fakes` provides factories `createFakePayment`, `createFakeEmail`, `createFakeHttp`,
`createFakeWebhookReceiver`. Each fake holds isolated in-memory state, exposes read-only views,
and — when given an `EffectContext` — routes its operations through `ctx.instrument` with fixed
kinds (`payment.charge`, `email.send`, `http:<METHOD> <path>`, `webhook.deliver`) and native dedup
detection. Without a context they behave as plain test doubles.

## Technical Context

**Language/Version**: TypeScript ~6.0

**Primary Dependencies**: `@replayguard/core` (types, `instrument`, `Clock`, `Sleeper`)

**Storage**: In-memory per fake instance

**Testing**: Vitest per fake; property tests (idempotency: N calls same key ⇒ 1 charge);
scenario examples reproducing each outcome class (SC-002)

**Target Platform**: any JS runtime

**Project Type**: Library package

**Performance Goals**: negligible overhead

**Constraints**: No real I/O; defaults safe (idempotency on for payment, off for email)

**Scale/Scope**: 4 fakes

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | No I/O; no raw card data stored (amount/currency/orderId only) | PASS |
| II Test-first | Tests per fake + example scenarios | PASS |
| III Modularity | depends on core only | PASS |
| IV Patterns | Factory, Template Method (shared idempotency store) | PASS |
| VI Types | Typed request/response shapes | PASS |
| VII Traceability | diagram.yaml + tasks | PASS |
| VIII Docs | Page per fake | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| Fresh, safely-defaulted fakes per case | **Factory** functions with option objects | Classes with public constructors and mutable config |
| Payment and HTTP share idempotency semantics (replay, conflict, in-flight) | **Shared component** `IdempotencyStore` (composition) | Duplicated logic per fake |
| Recording through ledger when available | **Adapter** over `EffectContext.instrument` (`recordable()`) | Fakes writing to the ledger directly — bypasses hooks, faults could not fire |

## Project Structure

```text
packages/fakes/src/
├── idempotency-store.ts   # replay / conflict / in-flight handling
├── recordable.ts          # wraps operations with ctx.instrument when ctx given
├── payment.ts             # createFakePayment
├── email.ts               # createFakeEmail
├── http.ts                # createFakeHttp
├── webhook.ts             # createFakeWebhookReceiver
└── index.ts
packages/fakes/test/
├── idempotency-store.test.ts  payment.test.ts  email.test.ts  http.test.ts  webhook.test.ts
└── outcomes.examples.test.ts   # each outcome class reproduced via scenarios
```

**Structure Decision**: Separate package so core stays minimal.

## Complexity Tracking

No violations.
