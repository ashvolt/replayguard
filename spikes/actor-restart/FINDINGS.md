# Spike findings: RivetKit actor host kill and restart (spec 012, T002)

Date: 2026-10-28 · `rivetkit` 2.3.27 (`@rivetkit/workflow-engine` 2.3.27) · Node 22

## Question

If the process hosting a workflow actor is killed in the middle of a step, does a new host on the
same storage resume the workflow from persisted history? Should the ReplayGuard parent own the
engine (option a), or should it restart both the engine and the host (option b)?

## Results

| # | Experiment | Result |
|---|---|---|
| A | In-process registry, `startEngine: true`, one workflow actor, two steps | Completes (Linux). The engine is ready in about 4 s from cold. |
| B | Host in a child process; `SIGKILL` after the charge applied, before the step result was saved; then a new host on the same storage | **The engine survives the kill** (it was spawned detached by host 1). Host 2 attaches to it in about 0.3 s. **About 23 s later the engine reschedules the actor onto host 2, and the workflow resumes and re-executes the step**, so the charge is applied twice. This is H1 (duplicate after a crash) reproduced through actors. |

### Other observations

1. **The engine outlives its host.** After a test ends, `rivet-engine start` keeps running and
   holding ports 6420 and 6421. A later run silently reuses it, together with its old storage and
   actor histories. The adapter must find and kill the engine when it is disposed, and must use a
   fresh storage path and ports for each scenario.
2. **Time to resume after a host kill is about 23 s** (runner-loss detection plus actor
   rescheduling). This dominates the cost of a crash case: about 25 s per kill case, compared
   with well under 1 s for the engine adapter. Defaults need larger case budgets, and exploring
   with actors should stay small.
3. **The host must run in test mode** (`registry.config.test.enabled = true`, as `rivetkit/test`
   does). Otherwise no `default` runner pool exists, and every call fails with
   `no_runner_config_configured`.
4. **`startServices: false` is required** in this setup. The optional services sidecar exits with
   status 1, which also prevents the runner pool from being configured.
5. **The RivetKit workflow API differs from `@rivet-dev/workflows`.** A step's `run` receives a
   *step context* (`(step) => …`). Actor state is reachable only there, through `step.state`, and
   `ctx.state` is undefined. Effects factories and workflows written for the engine adapter
   therefore do not run unchanged on actors.
6. **RivetKit 2.3.27 does not work on Windows.** None of the three runtime paths runs on a
   Windows machine:
   - `@rivetkit/rivetkit-napi-win32-x64-msvc@2.3.27` is published **without its `.node`
     binary** (2 files, 675 bytes; the Linux package is 46 MB), so the native runtime cannot load.
   - The WASM fallback cannot spawn the engine ("wasm runtimes cannot spawn an engine binary").
     Its default init also uses `fetch(file://…)`, which Node rejects; passing the bytes in
     `wasm.initInput` works around that.
   - `rivet-engine.exe` imports `libstdc++-6.dll`, which is not shipped (`STATUS_DLL_NOT_FOUND`).
     Git for Windows' copy has the wrong ABI (`STATUS_ENTRYPOINT_NOT_FOUND`).

   The spike ran under WSL Ubuntu, with dependencies installed using `--ignore-scripts
   --before=<7 days ago>`.

## Decision

**Option (a'): restart the host only, and let the engine persist across host kills.**

- Each scenario gets a fresh storage directory, free engine ports and a host child process.
  Host 1 starts the engine (`startEngine: true`), and the engine stays alive when a host is
  killed.
- `processKill` sends `SIGKILL` to the host at the anchor. The next run starts a new host with
  the same storage and endpoint, which attaches to the running engine.
- When the scenario is disposed, the adapter kills the host and the engine (found by PID,
  recorded or discovered) and deletes the storage directory. A leak check verifies this (T013).
- Restarting the engine as well (option b) is not needed. It would add about 4 s per restart,
  and it would also exercise engine recovery, which is beyond what ReplayGuard simulates.

## Consequences for spec 012

- Adapter tests run only on Linux and macOS. On Windows they skip with an explicit message that
  names the packaging gaps (T012), until RivetKit ships working Windows binaries.
- Report the Windows packaging gaps upstream, as drafts only (same approval rule as spec 013).
- Workflows and effects written for actors use the RivetKit step context. ReplayGuard's effects
  factory runs in the host, with ledger events relayed over the existing process protocol
  (spec 005/006). The conformance suite (T003) compares *outcomes*, not code.
- Default budget for actor kill cases: `graceMs` ≥ 30 s.

## Phase C: engine PID and ports

- The engine writes `{ pid, endpoint, bind_host }` to
  `<RIVETKIT_STORAGE_PATH>/.rivetkit/var/engine/runtime.json`, with its logs under
  `.rivetkit/var/logs/rivet-engine/`. When disposing, the adapter reads the PID from that file and
  sends `SIGKILL` to the engine.
- `enginePort: P` makes the engine listen on **P, P+1 and P+10**. Each scenario claims a port
  block whose three ports are all free, so concurrent scenarios do not share an engine.
