# Contract: `rg-diagrams` CLI

| Command | Effect | Exit codes |
|---|---|---|
| `rg-diagrams generate [--feature <id>]` | Writes `diagrams/<kind>.excalidraw`, `diagrams/<kind>.svg`, `diagrams/TRACEABILITY.md` for each source | 0 ok, 1 validation error |
| `rg-diagrams check [--feature <id>]` | Validates sources, task coverage, unknown IDs, freshness; writes nothing | 0 ok, 1 violations |
| `rg-diagrams coverage [--feature <id>]` | Prints per-feature coverage summary table | 0 |

Root scripts: `pnpm diagrams:generate`, `pnpm diagrams:check`.

`check` output example:

```text
✗ 004-effect-ledger: untraced T020; unknown T050; stale diagrams/hld.svg
✓ 005-fault-injection: 34/34 tasks traced
```

Sources discovered: `specs/*/diagram.yaml` (task-checked) and `docs/architecture/diagram.yaml`
(not task-checked). Paths are resolved from the repository root (directory containing
`pnpm-workspace.yaml`).
