# Data Model: Task Export

## BacklogItem

| Field | Type | Rules |
|---|---|---|
| `sourceId` | string | `001-diagrams-as-code`, `001-diagrams-as-code-US1`, `001-diagrams-as-code-T012`; unique |
| `type` | `"Epic" \| "Story" \| "Task" \| "Sub-task"` | Epic per feature; Story per user story; Sub-task for `[USn]` tasks; Task for setup/foundational/polish |
| `title` | string | ≤ 255 chars (Jira summary limit), truncated with `…` |
| `description` | string | Markdown; ends with `Source: specs/<feature>/<file>:<line>` |
| `parentSourceId` | string \| null | null only for Epic |
| `labels` | string[] | feature slug, phase label, `parallel` if `[P]`; lowercase, no spaces |
| `priority` | `"High" \| "Medium" \| "Low"` | see R5 |
| `status` | `"To Do" \| "Done"` | Done when checkbox is `[x]` |
| `feature` | string | feature folder name |
| `source` | `{ file, line }` | 1-based line |

## Backlog

Ordered `BacklogItem[]`: per feature (ascending), Epic, then Stories (US order), then tasks in
`tasks.md` order. Invariants: every parent precedes its children; every task appears once.

## ParsedTask

`{ id: "T012", done: boolean, parallel: boolean, story: number | null, description, phase, line }`

## ParsedStory

`{ number, title, priority: number, line }`

## ImportState (`.export-state/<target>.json`)

`{ target: "jira" | "github", created: Record<sourceId, trackerKey> }`
