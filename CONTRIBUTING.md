# Contributing to ReplayGuard

ReplayGuard is spec-driven. Every change follows the
[constitution](.specify/memory/constitution.md); please read it before your first PR.

## Workflow

1. **Spec first.** New features go through Spec Kit: `/speckit-specify` → `/speckit-clarify` →
   `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze`, then `/speckit-implement`. Each feature
   lives in `specs/NNN-name/`.
2. **Diagrams.** Update `specs/NNN-name/diagram.yaml` so that every task ID (`T###`) appears in a
   diagram, then run `pnpm diagrams:generate`.
3. **Backlog exports.** Run `pnpm export:generate` whenever tasks change.
4. **Tests first.** Write a failing test, make it pass, then refactor. Use property tests for
   invariants.
5. **Changeset.** Run `pnpm changeset` for any user-facing change to a published package.

## Local gates

```sh
pnpm install   # also installs git hooks (Biome + gitleaks pre-commit, Conventional Commits)
pnpm verify    # runs every CI gate except the OS matrix and GitHub-hosted scanners
```

| Gate | Command | Threshold |
|---|---|---|
| Lint/format | `pnpm lint` | 0 diagnostics |
| Package boundaries | `pnpm boundaries` | 0 violations |
| Types | `pnpm check-types` | 0 errors |
| Tests + coverage | `pnpm test` | ≥ 90% lines/branches/functions/statements per package |
| Mutation | `pnpm mutation` | ≥ 75% (≥ 85% for core faults and classifier) |
| Traceability | `pnpm diagrams:check`, `pnpm export:check` | every task traced; outputs fresh |
| API docs | `pnpm docs:api` | every public export has TSDoc |

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/), for example
`feat(core): add effect ledger`. The `commit-msg` hook enforces this.

## Package boundaries

`@replayguard/core` is pure TypeScript: it has no `node:*` imports and no Rivet imports. Only the
`adapter-*` packages may import Rivet. The full list of allowed dependencies between packages is in
`tools/quality/.dependency-cruiser.cjs`.
