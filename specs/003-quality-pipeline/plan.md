# Implementation Plan: Quality, Security & Release Pipeline

**Branch**: `003-quality-pipeline` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-quality-pipeline/spec.md`

## Summary

Scaffold all workspace packages with shared tsup/Vitest/TS configuration and coverage thresholds;
add dependency-cruiser boundary rules; lefthook pre-commit (Biome staged + gitleaks); GitHub
Actions workflows for CI matrix, security (CodeQL, OSV-Scanner, gitleaks), mutation (Stryker),
docs (TypeDoc) and release (Changesets + OIDC provenance + Syft SBOM + signed tags); Renovate
with 7-day minimum release age. One local command `pnpm verify` mirrors CI.

## Technical Context

**Language/Version**: TypeScript ~6.0, Node 22/24, YAML for workflows

**Primary Dependencies**: tsup, vitest + @vitest/coverage-v8, fast-check, @stryker-mutator/core +
vitest-runner, dependency-cruiser, lefthook, typedoc, @changesets/cli; Actions: checkout,
setup-node, pnpm/action-setup, codeql-action, osv-scanner-action, gitleaks-action,
anchore/sbom-action, changesets/action — all pinned by commit SHA

**Storage**: N/A

**Testing**: Self-test of gates: fixture violations (boundary, coverage) verified by tool tests;
workflows linted with `actionlint` in CI

**Target Platform**: GitHub Actions (ubuntu, windows, macos), developer machines

**Project Type**: Monorepo infrastructure

**Performance Goals**: PR pipeline < 15 min excluding mutation (SC-002)

**Constraints**: Least-privilege `permissions:`; no long-lived npm token; forks get no secrets

**Scale/Scope**: 8 publishable packages + 3 tool packages

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I Security | All mandated scanners, OIDC publish, SHA-pinned actions, least privilege | PASS |
| II Test-first | Thresholds in shared config; mutation gates | PASS |
| III Modularity | dependency-cruiser encodes constitution edges exactly | PASS |
| IV Patterns | Shared config factories (Factory) — recorded below | PASS |
| VI Types | Shared strict tsconfig | PASS |
| VII Traceability | `diagrams:check` and `export:check` in CI | PASS |
| VIII Docs | TypeDoc with `treatWarningsAsErrors` | PASS |

Post-design re-check: PASS.

## Design Patterns

| Problem | Pattern | Rejected alternative |
|---|---|---|
| 11 packages need identical build/test config with small overrides | **Factory** functions `defineTsupConfig()`, `defineVitestConfig()` in `@replayguard-tools/config` | Copy-pasted configs that drift |
| CI and local checks must be identical | **Facade** script `pnpm verify` orchestrating Turbo tasks | Hand-run command lists |

## Project Structure

```text
tools/config/              # workspace package @replayguard-tools/config (plain JS + .d.ts)
├── tsup.base.js
├── vitest.base.js           # coverage thresholds 90/90
└── stryker.base.json
packages/
├── core/  fakes/  adapter-workflows/  adapter-rivetkit/
├── reporter-console/  reporter-html/  vitest/  replayguard/
│   each: package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, src/index.ts, test/
tools/quality/
├── .dependency-cruiser.cjs
└── test/boundaries.test.ts  # fixture violations must be rejected
.github/
├── workflows/ci.yml  security.yml  mutation.yml  docs.yml  release.yml
└── CODEOWNERS
renovate.json
lefthook.yml
.changeset/config.json
typedoc.json
SECURITY.md  CONTRIBUTING.md
```

**Structure Decision**: Shared config is the workspace package `@replayguard-tools/config`, written
in plain JavaScript with `.d.ts` types. Stryker sandboxes copy only the package folder, so relative
`../../config` imports break there, and Node refuses to type-strip `.ts` inside `node_modules`.
Packages are scaffolded empty-but-buildable so later features only add code.

## Complexity Tracking

No violations. Renovate manages both npm dependencies and GitHub Action SHA pins, so no
Dependabot configuration is added.
