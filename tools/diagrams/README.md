# rg-diagrams

Diagrams-as-code for ReplayGuard specs. It turns each `specs/NNN-feature/diagram.yaml` into
editable **Excalidraw** scenes and static **SVG** previews. It also checks that every task ID in
the feature's `tasks.md` appears in at least one of its diagrams.

## Commands

```sh
pnpm diagrams:generate [--feature NNN-name]   # write diagrams/*.excalidraw|svg + TRACEABILITY.md
pnpm diagrams:check    [--feature NNN-name]   # fail on untraced/unknown task IDs or stale outputs
pnpm diagrams:coverage [--feature NNN-name]   # summary table
```

The commands exit with `0` on success, `1` on a validation, traceability or freshness failure, and
`2` on a usage error.

## `diagram.yaml`

Each file holds up to four diagrams: `hld`, `lld`, `workflow` and `architecture`.

| Layout | Use | Elements |
|---|---|---|
| `flow` | HLD, LLD, architecture | `nodes`, `edges`, optional `groups`, `direction: LR \| TB` |
| `sequence` | user workflow (`kind: workflow` only) | `actors`, ordered `messages` |

Nodes and messages take `tasks: [T001, …]`, which are drawn on the diagram. Node shapes are
`box`, `ellipse`, `diamond`, `database` and `package`; edge and message styles are `solid` and
`dashed`. For the full schema and limits, see
[`specs/001-diagrams-as-code/data-model.md`](../../specs/001-diagrams-as-code/data-model.md).

```yaml
feature: 004-effect-ledger
diagrams:
  - kind: hld
    title: Effect ledger in context
    layout: flow
    groups: [{ id: core, label: "@replayguard/core" }]
    nodes:
      - { id: ledger, label: EffectLedger, group: core, shape: database, tasks: [T011] }
      - { id: step, label: Workflow step, shape: ellipse }
    edges:
      - { from: step, to: ledger, label: records }
```

## Design

- **Strategy** (`layout/index.ts`): the diagram's `layout` value picks between the layered flow
  layout and the sequence layout.
- **Visitor targets** (`render/*`): both renderers read the same `LaidOutDiagram`, so the
  Excalidraw and SVG outputs always share the same geometry.
- **Factory** (`ids.ts`): element IDs and seeds are hashed from feature, kind and element, so
  running `generate` twice produces byte-identical files.
- **Swimlanes:** each group gets its own band, so group frames never overlap. A property test
  checks this.

## Notes

- YAML is the source of truth: regenerating overwrites edits made in Excalidraw.
- The SVG is a clean static render, not Excalidraw's hand-drawn style.
- `docs/architecture/diagram.yaml` is generated the same way but is not checked for task IDs.
- The tool runs on Node's native type stripping and makes no network calls.
