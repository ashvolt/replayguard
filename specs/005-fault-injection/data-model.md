# Data Model: Fault Injection

## FaultAnchor (discriminated by `type`)

| Variant | Fields | Rules |
|---|---|---|
| `effect` | `kind?: string`, `identity?: string`, `occurrence: number` | exactly one of `kind`/`identity`; occurrence ≥ 1 |
| `write` | `index: number` | ≥ 1; only with strategies `crash`, `processKill` |

Kind anchors match the attempt's `kind` **exactly** (e.g. fakes use `payment.charge`; a user
`instrument(fn, { kind: "payment" })` uses `payment`).

## FaultPoint

`"before" | "after"` (effect anchors only). `delay` ignores point (acts while in flight).

## FaultSpec

| Field | Type | Rules |
|---|---|---|
| `strategy` | `"none" \| "crash" \| "throwAfter" \| "delay" \| "processKill"` | |
| `anchor` | FaultAnchor | required except `none` |
| `point` | FaultPoint | required for effect anchors except `delay`; `throwAfter` requires `after` |
| `options.delayMs` | number | `delay` only, 1–600000 |
| `options.error` | `() => Error` | `throwAfter` only |

## FaultOutcome

`{ specIndex, strategy, triggered: boolean, faultId?: string, runIndex?: number, at?: number }`

## PersistenceControl (port)

`{ crash(): void; restart(): void; readonly crashed: boolean; readonly writeCount: number;
onBeforeWrite(cb: (index: number) => void): () => void }` — `restart()` clears the crashed flag
(models a new process on the same durable storage); `writeCount` keeps counting across restarts.

## IPC messages (Valibot-validated)

| Direction | Type | Payload |
|---|---|---|
| parent → child | `start` | `{ caseIndex, runIndex, storeDir, scenarioModule, input? }` |
| parent → child | `continue` | `{ seq }` |
| child → parent | `ledger-event` | `{ event: LedgerEvent }` |
| child → parent | `await-continue` | `{ seq }` |
| child → parent | `run-ended` | `{ outcome: RunOutcome }` |
| child → parent | `harness-error` | `{ message }` |
