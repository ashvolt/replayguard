# Upstream proposals for `@rivet-dev/workflows`

ReplayGuard found three engine behaviors that make side effects harder to keep safe. Each one
has a standalone reproduction and an issue draft here.

**Nothing is filed without explicit approval from the ReplayGuard maintainer (spec 013, FR-004).**

## Engine version

| Package | Version tested | Latest stable on npm | Checked |
|---|---|---|---|
| `@rivet-dev/workflows` | 1.0.0 | 1.0.0 (published 2026-08-31; newer `0.0.0-preview.*` builds exist) | 2026-10-28 |

All three gaps still reproduce on 1.0.0. Check again before filing: bump the pinned version in
each `repro-*/package.json`, run `pnpm test` in each folder, and update this table.

## Reproductions

Each folder is self-contained. You can copy it out of this repo and run `npm i && npm test`.

| Folder | Gap | `pnpm test` (expected behavior) | `pnpm test:gap` (today's behavior) |
|---|---|---|---|
| [repro-crash-loop-retries](repro-crash-loop-retries/) | A crash during `run()` is not counted toward `maxRetries`, so crash loops re-execute the step without bound | fails | passes |
| [repro-timeout-continuation](repro-timeout-continuation/) | A step timeout does not abort the running call; the timed-out call still lands | fails | passes |
| [repro-stable-step-identity](repro-stable-step-identity/) | Inside a step, public context cannot tell loop iterations apart, so derived idempotency keys collide | fails | passes |

`pnpm upstream:gaps` (repo root) and the `upstream-gaps` CI job run every repro in gap mode. If
upstream fixes a gap, that job fails, and the gap row and ReplayGuard's docs need updating.

## Drafts and tracker

| Draft | Repro | Status | Link | Decision |
|---|---|---|---|---|
| [01 Crash loops bypass maxRetries](drafts/01-crash-loop-retries.md) | repro-crash-loop-retries | draft | — | awaiting maintainer review |
| [02 Step timeout does not cancel the call](drafts/02-timeout-continuation.md) | repro-timeout-continuation | draft | — | awaiting maintainer review |
| [03 Stable step identity for idempotency keys](drafts/03-stable-step-identity.md) | repro-stable-step-identity | draft | — | awaiting maintainer review |

Status values are `draft`, `approved`, `filed`, `answered` and `closed`.

**Target repository.** The engine code lives in two repositories: `rivet-dev/workflows`, which
publishes `@rivet-dev/workflows`, and `rivet-dev/rivet`, under
`rivetkit-typescript/packages/workflow-engine`. The drafts target `rivet-dev/workflows`. Confirm
this when filing.

**Filing.** After approval, file a draft and record its link here:

```sh
gh issue create --repo rivet-dev/workflows --title "<title>" --body-file upstream/drafts/<draft>.md
```
