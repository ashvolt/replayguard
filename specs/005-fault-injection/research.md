# Research: Fault Injection

## R1 — Crash semantics in-process

- **Decision**: `crash` fires by (1) `ledger.recordFault`, (2) `persistence.crash()` (all further
  writes reject with `CrashSignal`), (3) `ledger.markRunDead(run)`, (4) throwing `CrashSignal`
  from the hook so the step stops immediately.
- **Rationale**: Spike F0 proved (2) is sufficient for non-ephemeral steps; (3)+(4) prevent the
  dead run from executing further effects in ephemeral sequences or catch-all user code.

## R2 — Persistence write anchors

- **Decision**: `FaultyDriver` counts write operations (`set`, `delete`, `deletePrefix`,
  `deleteRange`, `batch`, `setAlarm`, `clearAlarm`) 1-based per case; `onBeforeWrite(index)`
  callbacks can crash before the write applies.

## R3 — Lost response

- **Decision**: `throwAfter` only valid with point `after`; default error
  `SimulatedNetworkError("ECONNRESET: response lost after provider applied the effect")`;
  `options.error` factory overrides.

## R4 — Provider hang

- **Decision**: `delay` uses the `inFlight` hook to `await sleeper.sleep(ms)`; the attempt is
  already `started` so in-flight detection works; targeted occurrence only.

## R5 — Persistent driver for process kill

- **Decision**: `FileDriver` extends `InMemoryDriver` (public class) — loads `kv.json` on
  `open()`, and after each write persists the full KV atomically (`writeFile(tmp)` + `rename`),
  `latency = 0`. Alarms persisted alongside.
- **Rationale**: Reuses engine-compatible semantics (list ordering, prefix ops); small data sets
  in tests make full rewrites cheap.
- **Alternatives**: SQLite (`better-sqlite3`) — native build blocked by `allowBuilds`
  deny-by-default; JSON is enough.

## R6 — Child process protocol

- **Decision**: `child_process.fork(childEntry, [], { execArgv: [], serialization: "json",
  stdio: ["ignore","pipe","pipe","ipc"] })`. Parent sends `start { caseSpec, storeDir,
  runIndex }`; child sends `event { ledgerEvent }`, `settled-wait { seq }`, `run-ended { outcome }`.
  After every settled attempt the child awaits `continue`; parent either replies `continue` or
  kills (`child.kill("SIGKILL")`, which forcefully terminates on Windows too).
- **Validation**: every message parsed with Valibot; unknown messages → `HarnessError`.
- **User code loading**: child imports the user's scenario module path given in config
  (absolute file URL, must exist and be inside the project root) and calls its exported
  `scenarioFactory`.

## R7 — Determinism

- **Decision**: Anchors refer to `kindOccurrence`/`identityOccurrence` counted across runs within a
  case; occurrences are stable because cases replay identical workflows with identical inputs.

## R8 — Implementation refinements (2026-10-28)

- **Lost request**: `throwAfter` gained `point: "before"` (`fault.loseRequest`) — the request never
  reaches the provider; required for the 8-case exploration in spec 006 and for `skipped` detection.
- **Process checkpoints**: instead of a kill-only channel, the child pauses at `before-start`,
  `in-flight` and `after-settle`; the parent mirrors the ledger with authoritative occurrence counts
  across restarts and runs the same hooks. Crash-style faults kill the child; `throwAfter` replies
  with an error; `delay` simply delays the reply. Every strategy therefore works in process mode.
  Durable-write anchors are not supported there (no write relay).
- **`MemoryDriver`**: Rivet's `InMemoryDriver` awaits a timer per KV operation (~110 ms per run on
  Windows); `MemoryDriver` subclasses it with synchronous storage (same conformance suite). Needed
  for SC-002 and for deterministic timing in H3a.
- **`createCrashStrategy(name, isolated)`**: `processKill` reuses crash semantics with process
  isolation required.
