# Quickstart: Quality Pipeline

1. `pnpm install` (installs lefthook hooks via `prepare`).
2. `pnpm verify` — runs every CI gate locally (except OS matrix and scanners needing GitHub).
3. Add a changeset for user-facing changes: `pnpm changeset`.

## Validation scenarios

- Add `import "node:fs"` to `packages/core/src/index.ts` → `pnpm boundaries` fails.
- Delete a test so coverage < 90% → `pnpm test` fails naming the package.
- Stage a file containing `AKIA` + 16 uppercase chars → pre-commit gitleaks blocks the commit.
- Export a symbol without TSDoc → `pnpm docs` fails.

## One-time maintainer setup (outside the repo)

- npm: create the `replayguard` package and `@replayguard` org, enable trusted publishing for
  this repository's `release.yml`.
- GitHub: branch protection on `main` requiring all CI checks; enable CodeQL default alerts.
- Signing key for tags configured on the maintainer machine.
