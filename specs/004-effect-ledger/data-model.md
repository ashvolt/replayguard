# Data Model: Effect Ledger

## EffectAttempt

| Field | Type | Rules |
|---|---|---|
| `seq` | number | monotonic, starts at 1 per ledger |
| `runIndex` | number | run that made the call (0 = first run) |
| `kind` | string | 1–64 chars, `^[a-z0-9][a-z0-9:._/ -]*$`i |
| `subject` | string | ≤ 256 chars |
| `identity` | string | `${kind}::${subject}` |
| `kindOccurrence` | number | 1-based count of calls of this kind in the ledger |
| `identityOccurrence` | number | 1-based count of calls with this identity |
| `idempotencyKey` | string \| undefined | ≤ 255 chars |
| `startedAt` | number | clock ms |
| `settledAt` | number \| undefined | set on settle |
| `status` | `started \| applied \| deduplicated \| failed` | transitions only from `started` |
| `error` | `{ name, message, code? }` \| undefined | when `failed` |
| `inFlightAtFaults` | string[] | fault IDs recorded while `started` |
| `preview` | unknown \| undefined | only if `preview` option provided |

State machine: `started → applied | deduplicated | failed` (exactly once).

## RunRecord

`{ runIndex, startedAt, endedAt?, endReason?: "completed" | "failed" | "crashed" | "yielded" |
"waiting" | "killed" | "budget" | "harness-error", dead: boolean }`

## FaultEvent

`{ id: "F1", seq, runIndex, at, strategy, anchor: string, inFlight: number[] }`

## LedgerEvent (discriminated union, `type`)

`run-started`, `run-ended`, `attempt-started`, `attempt-settled`, `fault`.

## LedgerSnapshot

`{ version: 1, attempts: EffectAttempt[], faults: FaultEvent[], runs: RunRecord[],
finalized: boolean }` — plain JSON data, deep-frozen copy.

## PendingCall (hook input before an attempt exists)

`{ kind, subject, identity, kindOccurrence, identityOccurrence, idempotencyKey, runIndex }`
