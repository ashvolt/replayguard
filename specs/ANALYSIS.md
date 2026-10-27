# Specification Analysis Report — features 001–013

**Run**: 2026-10-28 · `/speckit-analyze` (all features) · constitution v1.0.0

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation | Status |
|----|----------|----------|-------------|---------|----------------|--------|
| C1 | Coverage | MEDIUM | 001 spec SC-004; tasks T031 | "Excalidraw files open without errors" has no verification task | Add structural validation + manual open check to T031 | Remediated |
| C2 | Coverage | MEDIUM | 002 spec FR-009; tasks T009 | Source back-reference (`file:line`) in descriptions not explicit in any task | Quote FR-009 in T009 | Remediated |
| C3 | Coverage | MEDIUM | 005 spec SC-002; tasks T029 | In-process vs process-kill parity not asserted | Extend T029 with parity assertion | Remediated |
| C4 | Coverage | MEDIUM | 006 spec edge case "baseline not clean"; tasks T016 | Flag missing | Extend T016 | Remediated |
| C5 | Coverage | LOW | 001 FR-012, 002 FR-012 (no network / deterministic) | Implicit only | Covered by golden tests + no-network test in T029 (001) | Remediated |
| C6 | Coverage | LOW | 003 SC-002 (< 15 min pipeline) | No measurement task | Track via CI duration in T032 | Remediated |
| I1 | Inconsistency | MEDIUM | 005 quickstart (`"payment"`) vs 006/008 (`"payment.charge"`) | Effect-kind naming drift for anchors | Document: anchors match the **exact** kind; quickstarts use `payment.charge` with fakes | Remediated |
| I2 | Inconsistency | LOW | 003 tasks T011 | Lists `valibot` as a root dev dependency, but it is a runtime dependency of `@replayguard/core` | Move to core package | Remediated |
| I3 | Inconsistency | LOW | 004 contract `afterSettle` sync vs 005 sync point | Already aligned (async allowed) during planning | — | Closed |
| I4 | Inconsistency | LOW | 005 `PersistenceControl.restart()` needed by 006 | Already aligned during planning | — | Closed |

No CRITICAL or HIGH findings. No constitution conflicts.

## Constitution Alignment

| Principle | Evidence |
|---|---|
| I Security | Dry-run defaults (002), no shell (002/005/012), CSP + escaping (009), scanners (003) |
| II Test-first | Every implementation task is preceded by a failing-test task; property + mutation gates |
| III Modularity | Boundary rules (003 T015); core purity enforced |
| IV Patterns | Every plan has a Design Patterns table with rejected alternatives |
| V Public API | Adapters use `runWorkflow`, `InMemoryDriver`, `EngineDriver`, `setup` only |
| VI Types | Strict config; typed errors; Valibot-inferred types |
| VII Traceability | Every feature has a diagram task covering all of its task IDs; export tool 002 |
| VIII Docs | TypeDoc gate (003 T028) + per-feature docs tasks |

## Coverage Summary

| Feature | FRs | FRs with ≥1 task | Tasks | Stories |
|---|---|---|---|---|
| 001 | 12 | 12 | 31 | 4 |
| 002 | 12 | 12 | 30 | 4 |
| 003 | 13 | 13 | 32 | 5 |
| 004 | 11 | 11 | 28 | 4 |
| 005 | 12 | 12 | 34 | 5 |
| 006 | 12 | 12 | 27 | 4 |
| 007 | 10 | 10 | 22 | 4 |
| 008 | 10 | 10 | 17 | 4 |
| 009 | 9 | 9 | 26 | 3 |
| 010 | 6 | 6 | 16 | 3 |
| 011 | 7 | 7 | 15 | 3 |
| 012 | 6 | 6 | 16 | 3 |
| 013 | 5 | 5 | 13 | 3 |

## Metrics

- Total requirements: 135 FR · Total tasks: 307
- Coverage: 100% (after remediation)
- Ambiguity count: 0 · Duplication count: 0 · Critical issues: 0

## Cross-feature implementation order

`001 → 002 → 003 → 004 → 005 (in-process) → 006 → 007 → 008 → 011 → 009 → 010 → 005 US4 + 006 T010
(process kill) → 013 → 012 (phase 2)`

## Next Actions

Proceed to `/speckit-implement` in the order above.
