# ReplayGuard Constitution

ReplayGuard is an Apache-2.0 TypeScript test library (npm: `replayguard`) that injects faults
around external side effects in Rivet durable workflows and classifies every effect as
`exactly-once`, `duplicated`, `deduplicated`, `orphaned`, `concurrent-duplicate`, or `skipped`.
It is a verification tool: its own correctness bar is therefore higher than that of the code it
tests.

## Core Principles

### I. Security & Supply-Chain First

- Dependencies MUST pass pnpm `minimumReleaseAge` (7 days); exceptions require a documented
  justification in the PR and an entry in `minimumReleaseAgeExclude`.
- Install scripts MUST be denied by default via `allowBuilds`; each allowed package needs a
  written reason.
- CI MUST run OSV-Scanner (dependency CVEs), CodeQL (static analysis) and gitleaks (secrets) on
  every PR; any high/critical finding blocks merge. Renovate manages updates.
- Releases MUST be published with npm provenance via GitHub OIDC trusted publishing (no long-lived
  npm tokens), from signed tags, with a CycloneDX SBOM attached.
- Library runtime code MUST NOT perform network I/O, telemetry, `eval`, `new Function`, or dynamic
  code loading. Fault injection MUST only affect objects the caller passed in.
- The HTML report MUST be a single self-contained file: no external URLs, all interpolated data
  HTML-escaped, a strict `Content-Security-Policy` meta tag, and no inline event handlers.
- Process-kill fault strategies MUST only spawn the caller's own test entrypoint with an
  allowlisted argument set; no shell interpolation (`shell: false`).

Rationale: a test tool runs inside every user's CI with their secrets in scope; it must be the
least risky dependency they install.

### II. Test-First, Verifiable Quality (NON-NEGOTIABLE)

- Red → Green → Refactor: a failing test MUST exist before implementation of each task.
- Every package MUST meet ≥90% line and ≥90% branch coverage (Vitest V8) and ≥75% Stryker
  mutation score; the classifier and fault engine in `core` MUST reach ≥85% mutation score.
- Invariants (e.g. "an effect applied N>1 times without dedup is never classified exactly-once")
  MUST be expressed as fast-check property tests.
- Tests MUST be deterministic: time, randomness and IDs are injected through ports (`Clock`,
  `Random`, `IdSource`); real timers only in clearly tagged integration tests.
- CI MUST run on Linux, Windows and macOS with Node 22 and 24.
- Every engine behavior ReplayGuard relies on MUST be pinned by a compatibility test against each
  supported `@rivet-dev/workflows` version (spike F0 tests are the seed).

Rationale: a false "exactly-once" verdict is worse than no tool at all.

### III. Hexagonal Modularity

- `@replayguard/core` MUST be pure TypeScript: it MUST NOT import Rivet packages, Node built-ins
  (`node:*`), or any reporter. OS-level faults (process kill) live in adapter packages. The
  unscoped `replayguard` package is a facade re-exporting `core`, `fakes` and `vitest`.
- Package graph (allowed edges only): `fakes → core`, `vitest → core`, `reporter-console → core`,
  `reporter-html → core`, `adapter-workflows → core`, `adapter-rivetkit → core, adapter-workflows`,
  `replayguard (facade) → core, fakes, vitest`.
  Reverse or sideways edges MUST fail the boundary check in CI.
- Each package MUST be independently buildable, testable and publishable; no deep imports
  across packages (only public `exports`).
- New packages require a written purpose; no organizational-only packages.

Rationale: Rivet's APIs will evolve; isolation keeps the blast radius to one adapter.

### IV. Purposeful Design Patterns

- A pattern MUST be applied only where it solves a named problem; each use MUST be recorded in
  the feature's `plan.md` under "Design Patterns" with problem, pattern, and rejected alternative.
- The project catalog (see "Design Pattern Catalog") is the default vocabulary; introducing a
  pattern outside it requires an ADR in `docs/adr/`.
- Patterns MUST NOT introduce indirection without a test that exercises the seam.

Rationale: patterns are for extension points (new faults, effects, reporters, runtimes), not
decoration.

### V. Public-API-Only Rivet Integration

- Adapters MUST use only exported APIs of `@rivet-dev/workflows` / `rivetkit` (e.g.
  `runWorkflow`, `InMemoryDriver` from `/testing`, `EngineDriver`). Monkey-patching, prototype
  mutation, or importing `dist/` internals is forbidden.
- Supported Rivet versions MUST be declared as peer ranges and verified in a CI matrix.
- Discovered engine gaps MUST be reported upstream (F10) with a minimal reproduction rather than
  worked around invisibly; workarounds MUST be documented in user-facing docs.

### VI. Type Safety & Simplicity

- TypeScript `~6.0` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`. `any`, non-null assertions and `@ts-ignore` are forbidden
  (`@ts-expect-error` allowed only in type tests with a reason).
- Biome MUST pass with zero warnings. Builds via tsup emit ESM + CJS + `.d.ts`.
- Public API MUST stay small: every export needs a use case in a spec; prefer one obvious way.
- Errors MUST be typed (`ReplayGuardError` subclasses with stable `code`), never bare strings.
- Versioning follows SemVer via Changesets; breaking changes require a MAJOR and migration notes.
- YAGNI: no speculative options; configuration is added when a spec scenario needs it.

### VII. Spec-Driven Traceability

- Every feature MUST flow through Spec Kit: `specify → clarify → plan → tasks → analyze` before
  `implement`. `analyze` CRITICAL findings block implementation.
- Every task ID (`T###`) MUST appear in at least one of the feature's Excalidraw diagrams (HLD,
  LLD, user workflow, technical architecture), generated from `diagram.yaml` by the
  diagrams-as-code tool; CI fails on missing IDs or stale SVGs.
- Tasks MUST be exportable without edits to Jira CSV, Jira REST JSON, GitHub Issues and generic
  CSV via `tools/export`. Task lines follow the Spec Kit checklist format so exports stay lossless.
- Every requirement (`FR-###`) MUST map to ≥1 task and ≥1 test.

### VIII. Documented Public Surface

- Every public export MUST have TSDoc with a runnable `@example`; TypeDoc generation MUST pass
  with `treatWarningsAsErrors`.
- User docs live as Markdown in `docs/`; each fault strategy and outcome class has a page that
  explains when it happens, with the spike evidence linked.
- `FINDINGS.md`-style evidence MUST accompany any claim about Rivet behavior.

## Technology & Security Constraints

| Concern | Mandated choice |
|---|---|
| Runtime | Node ≥22, TypeScript ~6.0 |
| Workspace | pnpm 12 workspaces + Turborepo |
| Build / lint | tsup (ESM+CJS+dts), Biome |
| Tests | Vitest, @vitest/coverage-v8, fast-check, Stryker |
| HTML report | single-file vanilla TS + inline SVG, zero runtime deps |
| Diagrams | Excalidraw `.excalidraw` + SVG, generated from per-feature `diagram.yaml` |
| Docs | Markdown + TypeDoc |
| CI / release | GitHub Actions (Linux/Windows/macOS × Node 22/24), Changesets, OIDC publish |
| Security | OSV-Scanner, Renovate, CodeQL, gitleaks, provenance, signed tags, CycloneDX SBOM |
| Spec process | GitHub Spec Kit (`specify` CLI, Claude Code integration, `sh` scripts) |

Changing any row requires a constitution amendment (MINOR).

## Design Pattern Catalog

| Pattern | Where | Problem solved |
|---|---|---|
| Ports & Adapters (Hexagonal) | `core` ports; `adapter-*` packages | Isolate core from Rivet API churn and runtimes |
| Strategy | `FaultStrategy` (driver-crash, throw-after-call, process-kill, timeout-hang) | Swap fault mechanics without changing the runner |
| Decorator | `FaultyDriver` wrapping an `EngineDriver` | Inject persistence faults without patching Rivet |
| Observer | `EffectLedger` ← fakes / instrumented effects; reporters subscribe | Record effects decoupled from who produces or reads them |
| Builder | `scenario().workflow().effects().faults().build()` | Readable, validated scenario construction |
| Template Method | `ScenarioLifecycle`: setup → run → inject → restart → settle → classify → report | One fixed lifecycle, pluggable steps |
| Specification | Classifier rules as composable predicates (`isDuplicated`, `isOrphaned`, …) | Independently testable, combinable outcome rules |
| Visitor | Reporters walk the `Report` model | Add output formats without touching the model |
| Factory | `createFakePayment()`, `createFakeEmail()`, … | Safe defaults, consistent fake construction |
| Null Object | `NoFault` strategy, `SilentReporter` | Remove conditionals for "no fault"/"no output" |

## Development Workflow & Quality Gates

1. Branch per feature `NNN-short-name` (Spec Kit numbering); Conventional Commits.
2. Spec Kit flow per Principle VII; `checklist` recommended for security-sensitive features.
3. PR gates (all required): Biome, typecheck, unit + property tests, coverage ≥90/90, Stryker
   threshold, boundary check, diagram traceability check, OSV-Scanner, CodeQL, gitleaks,
   TypeDoc, cross-OS matrix.
4. Review: at least one approving review; reviewer verifies constitution compliance and that
   `plan.md` "Constitution Check" and "Design Patterns" sections are accurate.
5. Release: Changesets PR → merge → signed tag → OIDC provenance publish → SBOM attached.

## Governance

- This constitution supersedes conflicting practices, templates and READMEs.
- Amendments: PR editing this file with a Sync Impact Report, rationale, and migration plan for
  in-flight specs; requires maintainer approval.
- Versioning: MAJOR = principle removal/redefinition; MINOR = new principle/section or mandated
  tool change; PATCH = wording/clarification.
- Compliance: every `plan.md` contains a Constitution Check gate; violations must be listed in
  "Complexity Tracking" with justification or the plan is rejected. A quarterly review checks
  gates still match CI configuration.

**Version**: 1.0.0 | **Ratified**: 2026-10-28 | **Last Amended**: 2026-10-28
