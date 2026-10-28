# Fault strategies

Faults are injected around effects recorded by `instrument()` or by the fakes. Every strategy fires
**at most once** per case. Anchors count occurrences **across restarts**, so `crashAfter("payment",
2)` means the second payment attempt in the case, even if it happens in a later run.

Every behavior below was observed in the engine-assumptions spike: see
[spikes/engine-assumptions/FINDINGS.md](../../spikes/engine-assumptions/FINDINGS.md).

Three of these behaviors are engine gaps, and each has a standalone reproduction and a proposal
draft in [upstream/](../../upstream/README.md):

- [crash loops bypass `maxRetries`](../../upstream/repro-crash-loop-retries/);
- [a step timeout does not cancel the call](../../upstream/repro-timeout-continuation/);
- [no stable step identity for idempotency keys](../../upstream/repro-stable-step-identity/).

CI runs these reproductions in gap mode, so ReplayGuard notices when upstream behavior changes.

| Helper | Strategy | What happens | Typical outcome without a fix |
|---|---|---|---|
| `fault.crashAfter(kind, n)` | `crash` | The provider applies the effect. Then durable storage dies, the run is marked dead, and the host restarts from durable state. | `duplicated` (spike H1). Crash loops bypass `maxRetries` (H2). |
| `fault.crashBefore(kind, n)` | `crash` | The process dies before the provider sees the call. | Effect retried after restart; usually `exactly-once` |
| `fault.crashAtWrite(i)` | `crash` | Crash before the *i*-th durable write by the engine (in-process runtime only). | Depends on the write |
| `fault.loseResponse(kind, n)` | `throwAfter` | The provider applies the effect, but the caller gets `SimulatedNetworkError` (`ECONNRESET`). | `duplicated` after the step retries (H0) |
| `fault.loseRequest(kind, n)` | `throwAfter` (`point: "before"`) | The request never reaches the provider, and the caller gets an error. | `skipped` if the workflow swallows the error |
| `fault.delay(kind, ms, n)` | `delay` | The provider hangs for `ms`. The call is **not cancelled** and completes later. | `concurrent-duplicate` with `retryOnTimeout` (H3a). `orphaned` with a critical timeout (H3b). |
| `fault.killAfter(kind, n)` | `processKill` | The real OS process is killed after the provider applied the effect. The next run starts a new process on the same file store. | Same as `crashAfter` (verified by parity tests) |

## Runtimes

- **`workflowsRuntime()`**: in-process and fast. Supports `crash`, `throwAfter`, `delay` and
  write anchors. Each case gets a fresh `MemoryDriver` wrapped in `FaultyDriver`, which is a
  decorator, so Rivet itself is never patched.
- **`workflowsProcessRuntime({ scenarioModule })`**: each run executes in a child process on a
  `FileDriver`. The child pauses at every effect checkpoint, before start, while in flight, and
  after settle. The parent decides whether to continue, return an error, or kill the child, so
  every effect strategy works, plus `processKill`.
  - Checkpoints are ordered per call, so a hanging call does not block other calls.
  - A host keeps running effects that outlived their run until they settle. A timed-out call
    therefore still lands in the background, and process isolation reproduces
    `concurrent-duplicate` and `orphaned` just like the in-process engine.
  - Limits:
    - Write anchors are not supported.
    - Scripted messages are not supported.
    - Workflow input must be JSON-serializable.

## Custom strategies

Implement `FaultStrategy` (`name`, `requiresProcessIsolation`, `arm(spec, env, index)`). Register
hooks on `env.ledger.addHooks(...)`, and use `env.persistence` and `env.sleeper`. Then pass the
strategy list to a runtime, or to `new FaultController([...DEFAULT_STRATEGIES, mine])`.
