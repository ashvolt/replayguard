# Research: Upstream Proposal

## R1 — Where to file

- Engine source exists in both `rivet-dev/rivet` (`rivetkit-typescript/packages/workflow-engine`)
  and `rivet-dev/workflows` (`packages/workflows`, published as `@rivet-dev/workflows`).
- **Decision**: Target `rivet-dev/workflows` (package that ships the behavior); mention the
  `rivet` copy in the issue. Final choice confirmed with the maintainer at filing time.

## R2 — Design options to propose

| Gap | Option A | Option B | Trade-off |
|---|---|---|---|
| H2 crash loops bypass `maxRetries` | Flush step metadata (`attempts++`, `status: running`) before `run()` | Persist a lightweight "started" marker key | Extra write per step (latency) vs. smaller write; ephemeral steps opt out |
| H3 timeout continuation | Pass an `AbortSignal` to step callbacks, aborted on timeout | Document + warn when `retryOnTimeout` used without abort-aware code | API change vs. docs only |
| Stable step identity | Expose `ctx.stepKey` (workflowId + location) inside step callbacks | Export a helper deriving it from public context | API surface vs. user responsibility |

## R3 — "Expect gap" mode

- **Decision**: Repro tests read `EXPECT_GAP=1` to invert assertions so ReplayGuard CI stays green
  and fails loudly when upstream behavior changes.
