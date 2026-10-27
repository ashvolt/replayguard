# Data Model: Quality Pipeline

## Package registry (allowed dependency edges)

| Package | Published name | May depend on |
|---|---|---|
| core | `@replayguard/core` | valibot |
| fakes | `@replayguard/fakes` | core |
| adapter-workflows | `@replayguard/adapter-workflows` | core; peer `@rivet-dev/workflows` |
| adapter-rivetkit | `@replayguard/adapter-rivetkit` | core, adapter-workflows; peer `rivetkit`, `@rivet-dev/workflows` |
| reporter-console | `@replayguard/reporter-console` | core |
| reporter-html | `@replayguard/reporter-html` | core |
| vitest | `@replayguard/vitest` | core; peer `vitest` |
| replayguard | `replayguard` | core, fakes, vitest |

## Gates

| Gate | Tool | Threshold | Blocking | Where |
|---|---|---|---|---|
| Lint/format | Biome | 0 diagnostics | yes | CI, pre-commit |
| Types | tsc | 0 errors | yes | CI matrix |
| Tests | Vitest | all pass | yes | CI matrix |
| Coverage | V8 | ≥ 90 lines/branches/functions/statements per package | yes | CI matrix |
| Mutation | Stryker | ≥ 75 (≥ 85 core faults/classifier) | yes | mutation.yml |
| Boundaries | dependency-cruiser | 0 violations | yes | CI |
| Traceability | rg-diagrams, rg-export | 0 untraced/stale | yes | CI |
| Dependencies | OSV-Scanner | no high/critical | yes | security.yml |
| Static analysis | CodeQL | no error-level alerts | yes | security.yml |
| Secrets | gitleaks | 0 findings | yes | CI, pre-commit |
| Docs | TypeDoc | 0 warnings | yes | docs.yml |
| Workflows | actionlint | 0 errors | yes | CI |
