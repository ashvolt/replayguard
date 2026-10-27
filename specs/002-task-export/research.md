# Research: Task Export

## R1 — Jira Cloud CSV hierarchy

- **Decision**: Columns `Issue Id`, `Parent Id`, `Issue Type`, `Summary`, `Description`,
  `Priority`, `Status`, and repeated `Labels` columns (one label per column). Rows ordered
  Epic → Story → Task/Sub-task so parents precede children.
- **Rationale**: Jira's CSV importer links any level through `Issue Id`/`Parent Id` mapping
  (sub-tasks, and epics via the unified Parent field); repeated `Labels` columns import multiple
  labels.
- **Alternatives**: `Epic Link`/`Epic Name` columns — deprecated with the unified Parent field.

## R2 — Jira REST

- **Decision**: `POST /rest/api/3/issue` per item in parent-first order with
  `fields.parent.key`; description as Atlassian Document Format paragraph; auth via
  `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY` env vars; retry 429/5xx with
  exponential backoff (max 5), stop on 4xx.
- **Alternatives**: Bulk endpoint `/issue/bulk` — cannot reference parents created in the same
  batch.

## R3 — GitHub Issues

- **Decision**: Milestone per feature, issue per Story/Task/Sub-task with labels; hierarchy via a
  task list in the Story body and a `Parent: #N` line in children; idempotency marker
  `<!-- rg-source: 004-T012 -->` in bodies plus local state file.
- **Alternatives**: GitHub sub-issues API — still evolving; task lists render everywhere.

## R4 — Stable IDs

- **Decision**: `<feature>` (epic), `<feature>-US<n>` (story), `<feature>-T<nnn>` (task).

## R5 — Priority mapping

- **Decision**: P1→High, P2→Medium, P3+→Low; non-story tasks Medium (FR-007).

## R6 — CSV encoding

- **Decision**: UTF-8 without BOM, CRLF row separators (RFC 4180), quote fields containing
  `,`, `"`, CR or LF; double inner quotes.
