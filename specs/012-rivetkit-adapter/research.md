# Research: RivetKit Adapter

## R1 — Hosting workflow actors in tests

- **Source**: `rivet-dev/workflows` `tests/e2e/preview-runtime.test.ts` (public API usage):
  `setup({ use: { wf }, startEngine: true, engineHost: "127.0.0.1", enginePort, shutdown:
  { disableSignalHandlers: true, gracePeriodMs } })`, `RIVETKIT_STORAGE_PATH` temp dir,
  `setupTest(context, registry)` from `rivetkit/test` for a client, engine PID in
  `<storage>/.rivetkit/var/engine/runtime.json` for cleanup.
- **Decision**: Child host process creates the registry; parent obtains a client to call actor
  actions (e.g. start, status).

## R2 — Crash semantics (open question → spike task)

- **Hypothesis**: Killing the host (runner) process while the engine keeps running, then starting a
  new host on the same storage/endpoint, resumes the actor workflow from persisted history.
- **Risk**: With `startEngine: true` the engine may be a child of the host; killing the host might
  orphan or kill the engine. The spike decides between (a) parent owns engine, children run
  registry only, or (b) kill both and restart both on same storage.
- **Decision deferred to spike T-spike result**; both options keep the `WorkflowRuntime` contract.

## R3 — Instrumented effects inside actor steps

- **Decision**: Effects factory executes in the child host; ledger events relayed with the 005
  protocol; afterSettle sync point preserved.

## R4 — Version matrix

- **Decision**: CI job for `rivetkit@2.3.x` latest and minimum (`2.3.11`).

## R5 — Implementation notes (2026-10-28)

- **Host per run instead of a long-lived `ActorHost` state machine (T007).** Each run forks a
  host process that loads the scenario module, builds the actor and relays effect checkpoints
  through the shared `relayRun` / `createCheckpointClient` from `adapter-workflows`. The engine
  started by the first host survives host kills (spike, phase B). When a case is disposed, the
  runtime kills the host processes and the engine (by the PID in its `runtime.json`) and
  removes the storage directory. The states idle → ready → killed → disposed are implicit in
  `runOnce` and `dispose`.
- **API amended to `actorWorkflow(fn, config)`** (maintainer decision; see the contract).
- **Ports**: `enginePort: P` binds P, P+1 and P+10; `findEnginePort()` claims a free block.
- **pnpm**: the Linux engine binary is published only as a musl build, so
  `supportedArchitectures.libc` includes `musl`. Without it, pnpm skips the binary on glibc.
- **Windows**: not supported by rivetkit 2.3.x (packaging gaps). Actor suites skip there, and
  elsewhere they need `REPLAYGUARD_ACTOR_TESTS=1`. The CI `rivetkit` job runs them on Ubuntu
  for 2.3.11 and 2.3.27.
