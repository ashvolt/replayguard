# Research: Effect Ledger

## R1 — Binding effects to a ledger without globals

- **Decision**: `instrument(ledger, fn, options)` returns a wrapper bound to that ledger; scenarios
  create effects per case through factories that receive an `EffectContext` exposing a
  pre-bound `instrument`.
- **Rationale**: No AsyncLocalStorage (would need `node:async_hooks` in core and breaks across
  processes); explicit binding is testable and isolation-safe.
- **Alternatives**: Global current-scenario registry — leaks between concurrent tests.

## R2 — Logical identity

- **Decision**: `identity = kind + "::" + subject`; `subject` default = FNV-1a-64 hex of canonical
  JSON of the argument array; override via `options.subject(...args)`.
- **Canonical JSON**: object keys sorted; `undefined` → omitted in objects, `null` in arrays;
  `Date` → ISO string; `Map`/`Set` → sorted entries; typed arrays → base64-free number arrays;
  functions, symbols, bigint and cycles → `ConfigError("RG_CONFIG_UNHASHABLE")`.
- **Rationale**: Retries re-invoke with equal arguments; non-cryptographic hash is fine (collision
  only merges identities, practically impossible at this scale; documented).

## R3 — Monotonic time

- **Decision**: `systemClock.now()` = `performance.timeOrigin + performance.now()` (global, no
  import); `manualClock` for tests.
- **Rationale**: Sub-millisecond precision for overlap detection; monotonic.

## R4 — Hooks vs observers

- **Decision**: Two channels: `subscribe()` (observers; listener errors are isolated and
  reported, never change control flow) and `addHooks()` (fault controller; may throw or await to
  alter control flow at `beforeStart`, `inFlight`, `afterSettle`).
- **Rationale**: Reporters must never be able to break a run; faults must.

## R5 — Dead-run semantics

- **Decision**: After a crash fault, `ledger.markRunDead(runIndex)`; any instrumented call in that
  run throws `CrashSignal` *before* starting an attempt.
- **Rationale**: A crashed process performs no further I/O; prevents phantom effects from code that
  catches the first signal (spec 005 edge case).

## R6 — Dedup detection

- **Decision**: `isDeduplicated(result, ...args)` user callback; fakes implement it natively.
- **Alternatives**: Infer from repeated idempotency key — wrong when provider ignores keys.
