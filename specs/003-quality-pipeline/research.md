# Research: Quality, Security & Release Pipeline

## R1 — Coverage enforcement

- **Decision**: `@vitest/coverage-v8` with `thresholds: { lines: 90, branches: 90, functions: 90,
  statements: 90 }` in `config/vitest.base.ts`, applied per package.
- **Rationale**: Per-package enforcement satisfies "per package" gate without a global average
  hiding weak packages.

## R2 — Mutation testing

- **Decision**: Stryker with `@stryker-mutator/vitest-runner`, `thresholds.break: 75`
  (core fault/classifier modules run a dedicated config with `break: 85`); incremental mode
  cached in CI.
- **Rationale**: Only mature JS mutation tool; incremental keeps PR runs short.
- **Finding (2026-10-28)**: `@stryker-mutator/vitest-runner` 10.0.0 never activates mutants under
  Vitest 5 (tests in `describe` are filtered out — upstream issues #6262/#6263/#6266, fixed in
  10.1.x which is newer than our 7-day release-age policy). Decision: pin Vitest 4.1.x repo-wide;
  core then scores 88.6%. Revisit when Stryker ≥ 10.1.1 passes the release-age gate.

## R3 — Boundary enforcement

- **Decision**: dependency-cruiser `forbidden` rules: one rule per disallowed edge class
  (core → anything internal/Rivet/node built-ins; reporters ↔ each other; adapters → reporters;
  deep imports into another package's `src`).
- **Rationale**: Checks actual import statements, including type-only imports.

## R4 — Security scanning

- **Decision**: CodeQL (`javascript-typescript`, security-extended queries) on PR + weekly;
  OSV-Scanner reusable workflow on PR + daily, failing on high/critical; gitleaks in lefthook
  pre-commit and CI with full history on main.
- **Alternatives**: `pnpm audit` — uses npm advisory DB only; OSV aggregates more sources.

## R5 — Release

- **Decision**: Changesets action opens version PR; on merge, `pnpm -r publish --provenance`
  under `id-token: write` using npm trusted publishing (no `NPM_TOKEN`); Syft
  (`anchore/sbom-action`) creates CycloneDX JSON for each packed tarball; release created with
  `gh release create` attaching SBOMs; tag signing by the maintainer's key (`git tag -s`) in a
  documented release step, verified in workflow with `git tag -v`.
- **Rationale**: Changesets handles monorepo versioning; OIDC removes long-lived secrets.

## R6 — Action pinning

- **Decision**: Pin each action to a full commit SHA with a version comment; Renovate
  `helpers:pinGitHubActionDigests` keeps them updated with the 7-day `minimumReleaseAge`.

## R7 — CI matrix

- **Decision**: `os: [ubuntu-latest, windows-latest, macos-latest]`, `node: [22, 24]`,
  `fail-fast: false`; Turbo cache keyed per OS/Node; lint, boundaries, traceability and docs run
  once on ubuntu/22.

## R8 — Git hooks

- **Decision**: lefthook `pre-commit`: `biome check --staged`, `gitleaks protect --staged`;
  `commit-msg`: Conventional Commit regex check.
