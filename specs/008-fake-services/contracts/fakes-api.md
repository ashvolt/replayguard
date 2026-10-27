# Contract: Fakes API (`@replayguard/fakes`)

```ts
export function createFakePayment(ctx?: EffectContext, options?: {
  idempotency?: boolean;               // default true
  inFlight?: "conflict" | "wait";      // default "conflict"
  latencyMs?: number;
  failures?: FailureScript;
  subject?: (req: ChargeRequest) => string;
}): FakePayment;

export interface FakePayment {
  charge(req: ChargeRequest): Promise<ChargeResult>;
  refund(chargeId: string): Promise<{ refunded: boolean }>;
  readonly charges: readonly Charge[];
}

export function createFakeEmail(ctx?: EffectContext, options?: {
  latencyMs?: number; failures?: FailureScript; subject?: (m: EmailInput) => string;
}): FakeEmail;
export interface FakeEmail { send(m: EmailInput): Promise<{ id: string }>; readonly outbox: readonly EmailMessage[] }

export function createFakeHttp(ctx?: EffectContext, options?: { routes: HttpRoute[] }): FakeHttp;
export interface FakeHttp {
  request(method: string, path: string, init?: { headers?: Record<string, string>; body?: unknown }):
    Promise<{ status: number; body: unknown; replayed: boolean }>;
  readonly requests: readonly HttpRequestRecord[];
}

export function createFakeWebhookReceiver(ctx?: EffectContext, options?: {
  dedup?: boolean;                     // default true
  failFirst?: number;                  // default 0
  latencyMs?: number;
}): FakeWebhookReceiver;
export interface FakeWebhookReceiver {
  deliver(event: WebhookEvent): Promise<{ status: number; deduplicated: boolean }>;
  readonly processed: readonly WebhookEvent[];
  readonly deliveries: readonly WebhookDeliveryRecord[];
}

export interface FailureScript { times: number; error?: () => Error; status?: number }
export class IdempotencyConflictError extends Error { readonly code: "RG_FAKE_IDEMPOTENCY_CONFLICT" }
export class IdempotencyInFlightError extends Error { readonly code: "RG_FAKE_IDEMPOTENCY_IN_FLIGHT" }
```
