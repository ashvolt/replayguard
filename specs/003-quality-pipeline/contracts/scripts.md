# Contract: Root scripts

| Script | Runs |
|---|---|
| `pnpm verify` | lint → boundaries → check-types → test (coverage) → diagrams:check → export:check → docs |
| `pnpm lint` | `biome check .` |
| `pnpm boundaries` | dependency-cruiser over `packages/*/src` |
| `pnpm check-types` | `turbo run check-types` |
| `pnpm test` | `turbo run test` (coverage thresholds enforced) |
| `pnpm mutation` | Stryker per package |
| `pnpm docs:api` | TypeDoc → `docs/api` (git-ignored) |
| `pnpm changeset` | create a changeset |

## Workflow triggers & permissions

| Workflow | Triggers | Permissions |
|---|---|---|
| ci.yml | pull_request, push main | contents: read |
| security.yml | pull_request, push main, schedule weekly/daily | contents: read, security-events: write |
| mutation.yml | schedule weekly, pull_request (paths packages/core/**) | contents: read |
| docs.yml | pull_request, push main | contents: read |
| release.yml | push main | contents: write, pull-requests: write, id-token: write |
