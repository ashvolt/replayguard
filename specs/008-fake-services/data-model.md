# Data Model: Fake Services

## Charge

`{ id: "ch_000001", orderId: string, amount: number (integer minor units, > 0),
currency: string (ISO 4217, default "usd"), idempotencyKey?: string, createdAt: number }`

## ChargeRequest: `{ orderId, amount, currency?, idempotencyKey? }`

## ChargeResult: `{ charge: Charge, replayed: boolean }`

## EmailMessage: `{ id: "msg_000001", to: string, template: string, data?: unknown, sentAt }`

## HttpRoute: `{ method, path, status = 200, body?, latencyMs?, idempotencyHeader?: string }`

## HttpRequest record: `{ method, path, headers, body, status, replayed, at }`

## WebhookEvent: `{ id: string, type: string, payload: unknown }`

## WebhookDelivery record: `{ eventId, status: number, deduplicated: boolean, at }`

## IdempotencyEntry: `{ key, fingerprint, state: "in-flight" | "done", result? }`

IDs are sequential per fake instance (deterministic).
