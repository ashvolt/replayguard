---

description: "Task list for 003-quality-pipeline"
---

# Tasks: Quality, Security & Release Pipeline

**Input**: Design documents from `/specs/003-quality-pipeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required for tooling with logic (boundary rules); workflows validated by actionlint.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create shared config factories `defineTsupConfig`, `defineVitestConfig` (coverage 90/90/90/90) as workspace package `@replayguard-tools/config` in tools/config/tsup.base.js and tools/config/vitest.base.js
- [X] T002 [P] Create Stryker base config (vitest runner, `break: 75`) in tools/config/stryker.base.json
- [X] T003 Scaffold `@replayguard/core` (package.json exports ESM/CJS/types, tsconfig, tsup, vitest, src/index.ts) in packages/core/
- [X] T004 [P] Scaffold `@replayguard/fakes` in packages/fakes/
- [X] T005 [P] Scaffold `@replayguard/adapter-workflows` (peer `@rivet-dev/workflows ^1.0.0`) in packages/adapter-workflows/
- [X] T006 [P] Scaffold `@replayguard/reporter-console` in packages/reporter-console/
- [X] T007 [P] Scaffold `@replayguard/reporter-html` in packages/reporter-html/
- [X] T008 [P] Scaffold `@replayguard/vitest` (peer `vitest >=4 <6`) in packages/vitest/
- [X] T009 [P] Scaffold `@replayguard/adapter-rivetkit` (peers rivetkit, workflows) in packages/adapter-rivetkit/
- [X] T010 [P] Scaffold facade `replayguard` in packages/replayguard/
- [X] T011 Install root dev dependencies (tsup, vitest, coverage-v8, fast-check, stryker, dependency-cruiser, lefthook, typedoc, changesets) and `valibot` as runtime dependency of core, respecting 7-day release age, in package.json and packages/core/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T012 Add `pnpm verify` facade script and per-task Turbo pipeline (lint, boundaries, check-types, test, diagrams:check, export:check, docs) in package.json and turbo.json
- [X] T013 Add CONTRIBUTING.md (Spec Kit flow, gates, commit convention) and SECURITY.md (reporting policy) at repository root

**Checkpoint**: Every package builds and tests (empty) locally.

---

## Phase 3: User Story 1 - Every pull request is gated on quality (Priority: P1) 🎯 MVP

**Goal**: CI matrix enforcing lint, types, tests+coverage, boundaries, traceability.

**Independent Test**: Fixture violation (core importing `node:fs`) fails `pnpm boundaries`.

- [X] T014 [P] [US1] Write failing boundary tests with fixture violations for each forbidden edge in tools/quality/test/boundaries.test.ts
- [X] T015 [US1] Implement dependency-cruiser rules encoding constitution edges in tools/quality/.dependency-cruiser.cjs and tools/quality/package.json
- [X] T016 [US1] Create CI workflow (ubuntu/windows/macos × Node 22/24, fail-fast false, SHA-pinned actions, `permissions: contents: read`) in .github/workflows/ci.yml
- [X] T017 [P] [US1] Add actionlint job validating workflows in .github/workflows/ci.yml
- [X] T018 [P] [US1] Add lefthook config (pre-commit Biome staged + gitleaks protect; commit-msg Conventional Commits) in lefthook.yml

---

## Phase 4: User Story 2 - Security scanning on every change (Priority: P1)

**Goal**: CodeQL, OSV-Scanner, gitleaks, Renovate with 7-day age.

**Independent Test**: Test branch with fake AWS key fails gitleaks; vulnerable dep fixture fails OSV.

- [X] T019 [US2] Create security workflow (CodeQL security-extended; OSV-Scanner fail on high/critical; gitleaks full history) in .github/workflows/security.yml
- [X] T020 [P] [US2] Add gitleaks config with allowlist for test fixtures in .gitleaks.toml
- [X] T021 [P] [US2] Add Renovate config (`minimumReleaseAge: "7 days"`, grouped updates, `helpers:pinGitHubActionDigests`) in renovate.json
- [X] T022 [P] [US2] Add CODEOWNERS for workflows and security-sensitive paths in .github/CODEOWNERS

---

## Phase 5: User Story 3 - Mutation testing (Priority: P2)

**Goal**: Stryker gates (75%, core faults/classifier 85%).

**Independent Test**: `pnpm mutation --filter @replayguard/core` produces report and enforces threshold.

- [X] T023 [US3] Add per-package Stryker configs extending base (core: separate 85% config for faults/ and classifier/) in packages/core/stryker.config.json
- [X] T024 [US3] Create mutation workflow (weekly + PR paths packages/core/**, incremental cache, upload HTML report) in .github/workflows/mutation.yml

---

## Phase 6: User Story 4 - Trustworthy releases (Priority: P2)

**Goal**: Changesets, OIDC provenance, Syft SBOM, signed tags.

**Independent Test**: Release workflow dry-run (`workflow_dispatch` with `dry-run: true`) shows provenance and SBOM steps, no NPM_TOKEN.

- [X] T025 [US4] Initialize Changesets (`access: public`, linked `@replayguard/*`) in .changeset/config.json
- [X] T026 [US4] Create release workflow (changesets/action, `id-token: write`, `pnpm -r publish --provenance`, anchore/sbom-action per tarball, `gh release create` with SBOMs, `git tag -v` verification) in .github/workflows/release.yml
- [X] T027 [P] [US4] Document maintainer release steps (signed tags, trusted publishing setup) in docs/maintainers/releasing.md

---

## Phase 7: User Story 5 - Generated API documentation (Priority: P3)

**Goal**: TypeDoc with warnings as errors.

**Independent Test**: Export without TSDoc fails `pnpm docs:api`.

- [X] T028 [US5] Add TypeDoc config (`entryPointStrategy: packages`, `treatWarningsAsErrors`, `validation.notDocumented`) in typedoc.json
- [X] T029 [US5] Create docs workflow in .github/workflows/docs.yml

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T030 [P] Add README with badges, install, quick example in README.md
- [X] T031 Author diagrams covering T001–T032 in specs/003-quality-pipeline/diagram.yaml
- [X] T032 Run `pnpm verify` end-to-end, record CI duration against the 15-minute target (SC-002) and validate quickstart in specs/003-quality-pipeline/quickstart.md

## Dependencies & Execution Order

- Setup (T001–T011) → Foundational → US1 → US2 → US3/US4/US5 (parallel) → Polish.
- Package scaffolds (T003–T010) block all product features 004–012.

## Parallel Example

```bash
Task: "T004 fakes"  Task: "T005 adapter-workflows"  Task: "T006 reporter-console"  Task: "T007 reporter-html"
```

## Implementation Strategy

MVP = US1 (PR gating) + US2 (security). Release and docs land before first publish.
