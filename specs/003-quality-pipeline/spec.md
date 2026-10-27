# Feature Specification: Quality, Security & Release Pipeline

**Feature Branch**: `003-quality-pipeline`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Set up the perfect pipeline for a public, security-first, fully testable library: cross-OS CI matrix, coverage and mutation gates, package boundary enforcement, dependency/secret/static scanning, provenance-signed releases with SBOM, Changesets versioning, TypeDoc docs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every pull request is gated on quality (Priority: P1)

A contributor opens a PR; automated checks run lint, typecheck, unit/property tests with coverage
thresholds, package boundary rules and diagram traceability on Linux, Windows and macOS with two
Node versions. Merge is blocked unless all pass.

**Why this priority**: Quality gates are the backbone of the constitution; everything else builds
on them.

**Independent Test**: Open a PR that drops coverage below threshold; the check fails with the
package and metric named.

**Acceptance Scenarios**:

1. **Given** a PR with a lint violation, **When** CI runs, **Then** the lint job fails and annotates
   the file and line.
2. **Given** a PR reducing a package's branch coverage to 85%, **When** CI runs, **Then** the test
   job fails naming the package and the 90% threshold.
3. **Given** a PR where `core` imports a Rivet package, **When** CI runs, **Then** the boundary job
   fails naming the forbidden edge.
4. **Given** a PR that passes everything, **When** CI completes, **Then** all 6 OS × Node matrix
   cells are green.

---

### User Story 2 - Security scanning on every change (Priority: P1)

A maintainer needs assurance that no vulnerable dependency, leaked secret or dangerous code
pattern enters the repository.

**Why this priority**: Security-first principle; a test tool runs with users' CI secrets in scope.

**Independent Test**: Commit a fake AWS key in a branch; the secret scan fails. Add a dependency
with a known critical advisory; the dependency scan fails.

**Acceptance Scenarios**:

1. **Given** a commit containing a credential-shaped string, **When** pre-commit or CI runs,
   **Then** the secret scan fails and identifies the file.
2. **Given** a dependency with a high or critical advisory, **When** CI runs, **Then** the
   dependency scan fails listing the advisory ID.
3. **Given** code using dynamic code evaluation, **When** static analysis runs, **Then** it reports
   a finding and the PR is blocked.
4. **Given** a dependency version published less than 7 days ago, **When** installing, **Then** the
   install is refused unless explicitly excluded with justification.

---

### User Story 3 - Mutation testing proves tests catch bugs (Priority: P2)

A maintainer wants evidence that tests detect real defects, not just execute lines.

**Why this priority**: Critical for a verification tool, but slower, so runs on a schedule and on
PRs touching `core`.

**Independent Test**: Run mutation testing on `core`; the score report is produced and enforced.

**Acceptance Scenarios**:

1. **Given** a package below 75% mutation score (85% for core classifier/fault engine), **When**
   mutation CI runs, **Then** it fails and uploads the HTML mutation report.

---

### User Story 4 - Trustworthy releases (Priority: P2)

A user installing `replayguard` can verify where and how it was built.

**Why this priority**: Supply-chain integrity for consumers.

**Independent Test**: Run the release workflow in dry-run; inspect that provenance publishing,
SBOM generation and tag signing steps are configured and that no long-lived npm token is used.

**Acceptance Scenarios**:

1. **Given** merged changesets, **When** the release workflow runs, **Then** a version PR is opened;
   on merge, packages are published with provenance attestations via OIDC trusted publishing.
2. **Given** a release, **When** a user inspects it, **Then** a CycloneDX SBOM is attached to the
   GitHub release and the git tag is signed.

---

### User Story 5 - Generated API documentation (Priority: P3)

A user browses API reference docs generated from TSDoc.

**Why this priority**: Required by constitution, but valuable only once APIs exist.

**Independent Test**: Run the docs build; missing TSDoc on an export fails the build.

**Acceptance Scenarios**:

1. **Given** a public export without TSDoc, **When** the docs build runs, **Then** it fails naming
   the symbol.

### Edge Cases

- Windows path separators and line endings in tests and generated files (LF enforced).
- Flaky tests → no automatic retries; failures must be fixed (deterministic-test principle).
- Matrix job for Node 24 failing while 22 passes → both required; no allow-failure.
- Forked PRs → no secrets exposed; release jobs never run on forks.
- Renovate PRs respect the 7-day release age.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: CI MUST run lint, typecheck, tests with coverage, boundary check, and diagram
  traceability check on Linux, Windows and macOS with Node 22 and 24 for every PR and push to main.
- **FR-002**: Coverage thresholds MUST be ≥90% lines and ≥90% branches per package, enforced by
  the test runner configuration.
- **FR-003**: Mutation testing MUST run weekly and on PRs touching `packages/core`, enforcing ≥75%
  per package and ≥85% for core classifier and fault engine modules.
- **FR-004**: A boundary check MUST enforce the constitution's allowed package dependency edges.
- **FR-005**: Dependency vulnerability scanning MUST block high/critical advisories.
- **FR-006**: Static analysis MUST run on every PR and on a weekly schedule.
- **FR-007**: Secret scanning MUST run in pre-commit hooks and CI.
- **FR-008**: Automated dependency update PRs MUST be configured with a minimum release age of
  7 days and grouped updates.
- **FR-009**: Versioning MUST use changesets; release MUST publish with provenance through OIDC,
  create signed tags, and attach a CycloneDX SBOM.
- **FR-010**: Workflows MUST use least-privilege permissions and pin third-party actions by commit
  SHA.
- **FR-011**: API docs MUST build from TSDoc with warnings treated as errors.
- **FR-012**: A single local command MUST run the same checks as CI (except cross-OS matrix).
- **FR-013**: Workspace package scaffolding MUST exist for all planned packages with shared build,
  test and lint configuration.

### Key Entities

- **Workflow**: CI, mutation, security, release, docs.
- **Gate**: named check with threshold and blocking status.
- **Package**: workspace member with allowed dependency edges.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A PR with any gate violation is blocked 100% of the time.
- **SC-002**: Full PR pipeline (excluding mutation) completes in under 15 minutes.
- **SC-003**: Zero long-lived publishing secrets stored in the repository settings.
- **SC-004**: Every published version has a provenance attestation and an SBOM.

## Assumptions

- Repository is public on GitHub, so CodeQL and Actions minutes are free.
- npm trusted publishing is configured by the maintainer in npm settings once the package exists.
- Tag signing uses the maintainer's or a bot's signing key configured outside the repository.
