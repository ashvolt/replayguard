# Data Model: Diagrams-as-Code

## DiagramSource (file `diagram.yaml`)

| Field | Type | Rules |
|---|---|---|
| `feature` | string | `^\d{3}-[a-z0-9-]+$` or `architecture`; must equal containing folder name |
| `diagrams` | DiagramDefinition[] | 1–4 entries; `kind` unique |

## DiagramDefinition

| Field | Type | Rules |
|---|---|---|
| `kind` | `"hld" \| "lld" \| "workflow" \| "architecture"` | unique per source |
| `title` | string | 1–120 chars |
| `layout` | `"flow" \| "sequence"` | `sequence` only allowed for `kind: workflow` |
| `direction` | `"LR" \| "TB"` | flow only; default `LR` |
| `groups` | Group[] | flow only; optional |
| `nodes` | Node[] | flow: 1–40 |
| `edges` | Edge[] | flow: 0–80 |
| `actors` | Actor[] | sequence: 2–10 |
| `messages` | Message[] | sequence: 1–60 |

## Node

| Field | Type | Rules |
|---|---|---|
| `id` | string | `^[a-z][a-z0-9-]*$`, unique in diagram |
| `label` | string | 1–80 chars |
| `shape` | `"box" \| "ellipse" \| "diamond" \| "database" \| "package"` | default `box` |
| `group` | string | must reference a declared group id |
| `tasks` | string[] | each `^T\d{3,}$`; unique |
| `note` | string | optional, ≤ 120 chars, rendered under label |

## Edge

| Field | Type | Rules |
|---|---|---|
| `from` / `to` | string | must reference declared node ids |
| `label` | string | optional, ≤ 40 chars |
| `style` | `"solid" \| "dashed"` | default `solid` |

## Group: `{ id, label }` — id unique; label ≤ 60 chars.

## Actor: `{ id, label }`; Message: `{ from, to, label, tasks?, style? }` (refs to actors).

## LaidOutDiagram (internal)

`{ width, height, shapes: Shape[], arrows: Arrow[], frames: Frame[], texts: Text[] }` with integer
coordinates — the single input to both renderers.

## TraceabilityRecord

`{ feature, taskId, kind, element }` — rows of `diagrams/TRACEABILITY.md`.

## TraceCheckResult

`{ feature, untraced: string[], unknown: string[], stale: string[], missingSource: boolean }`;
`ok` when all arrays empty and source present (or feature has no `tasks.md`).
