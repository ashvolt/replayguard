# rg-export

Turns every `specs/NNN-feature/spec.md` and `tasks.md` into tracker-ready backlog files: one Epic
per feature, one Story per user story, and a Sub-task per story task. Setup, foundational and polish
tasks become plain Tasks under the Epic.

```sh
pnpm export:generate      # writes exports/jira.csv, jira.json, github-issues.json, backlog.csv
pnpm export:check         # fails if exports/ is stale or a task line is malformed (CI)
```

| Field | Rule |
|---|---|
| Source IDs | `004-effect-ledger` (Epic), `004-effect-ledger-US1` (Story), `004-effect-ledger-T012` (task) |
| Priority | Story P1 → High, P2 → Medium, P3+ → Low; story tasks inherit it, other tasks get Medium |
| Labels | feature slug, phase (`setup`, `foundational`, `us1`, …, `polish`), and `parallel` for `[P]` tasks |
| Status | `- [x]` → Done, otherwise To Do |
| Traceability | every description ends with `Source: specs/<feature>/<file>:<line>` |

## Jira: CSV import, no credentials needed

1. Run `pnpm export:generate`.
2. In Jira, go to **Settings → System → External System Import → CSV** and upload `exports/jira.csv`.
3. Map the columns:
   - `Issue Id` → Issue Id
   - `Parent Id` → Parent Id
   - `Issue Type`, `Summary`, `Description`, `Priority` and `Status` → the Jira fields of the same name
   - every `Labels` column → Labels
4. Check the result: one Epic per feature, Stories under their Epics, and Sub-tasks under their
   Stories.

`Issue Id` values are row numbers that exist only to link rows during import. The stable ID is the
last line of each description (`ReplayGuard-ID: …`).

## Jira: REST import

```sh
export JIRA_BASE_URL=https://your-site.atlassian.net JIRA_EMAIL=you@example.com \
       JIRA_API_TOKEN=*** JIRA_PROJECT_KEY=RG   # optional: JIRA_SUBTASK_TYPE=Subtask
pnpm export:import-jira                    # dry run: prints planned creates, no network
pnpm export:import-jira --apply            # creates Epics, then Stories, then Tasks/Sub-tasks
pnpm export:import-jira --apply --include-done
```

- Credentials are read only from the environment. They are never logged, and error messages redact
  them.
- Rate limits (429) and server errors (5xx) are retried with exponential backoff up to 5 times. Any
  other error stops the import.
- Created keys are stored in `.export-state/jira.json`, which is git-ignored, so running the import
  again skips anything already created.

## GitHub Issues

```sh
pnpm export:import-github --repo owner/name            # dry run
pnpm export:import-github --repo owner/name --apply    # needs an authenticated `gh`
```

- Each feature becomes a milestone named after its Epic. Missing labels are created first.
- Every child issue body contains `Parent: #N`, and every issue body ends with
  `<!-- rg-source: … -->`. Running again finds existing issues by that marker and skips them.
- `gh` is run with an argument array, never through a shell.

## Linear, Azure Boards and others

Import `exports/backlog.csv` and map these columns: `id`, `parent_id`, `type`, `title`,
`description`, `labels` (`;`-separated), `priority`, `status` and `feature`.

## Design

- **Strategy:** `RENDERERS` maps each output file to its renderer, and every renderer reads the same
  backlog model.
- **Template Method:** `runImport` defines the fixed import sequence (select, prepare, look up
  existing issues, create parents first, save state). The Jira and GitHub targets fill in the steps.
- **Ports & Adapters:** `HttpPort` (`fetch`) and `CommandPort` (`execFile`) are injected, so tests
  never touch the network.
