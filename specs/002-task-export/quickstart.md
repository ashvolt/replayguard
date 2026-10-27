# Quickstart: Task Export

## Jira (CSV, no credentials)

1. `pnpm export:generate`
2. Jira → Settings → System → External System Import → CSV → upload `exports/jira.csv`.
3. Map columns: Issue Id → Issue Id, Parent Id → Parent Id, Issue Type → Issue Type, Summary,
   Description, Priority, Status, Labels → Labels.
4. Verify: one Epic per feature, Stories under Epics, Sub-tasks under Stories.

## Jira (REST)

```sh
export JIRA_BASE_URL=https://your.atlassian.net JIRA_EMAIL=you@example.com \
       JIRA_API_TOKEN=*** JIRA_PROJECT_KEY=RG
pnpm export:import-jira            # dry run
pnpm export:import-jira --apply    # create; re-run safe
```

## GitHub Issues

```sh
pnpm export:import-github --repo owner/replayguard           # dry run
pnpm export:import-github --repo owner/replayguard --apply
```

## Linear / Azure Boards / others

Import `exports/backlog.csv`; map `id`, `parent_id`, `type`, `title`, `description`, `labels`.
