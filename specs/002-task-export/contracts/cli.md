# Contract: `rg-export` CLI

| Command | Effect |
|---|---|
| `rg-export generate [--feature <id>]` | Writes `exports/jira.csv`, `exports/jira.json`, `exports/github-issues.json`, `exports/backlog.csv` |
| `rg-export check` | Regenerates in memory; exit 1 if `exports/` is stale or any task line is malformed |
| `rg-export import-jira [--apply] [--include-done]` | Dry-run by default: prints planned creates. `--apply` requires `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY` |
| `rg-export import-github [--apply] [--repo owner/name]` | Dry-run by default: prints planned milestones/issues. `--apply` uses authenticated `gh` |

## Jira CSV columns

`Issue Id,Parent Id,Issue Type,Summary,Description,Priority,Status,Labels,Labels,Labels,Labels`

## Generic CSV columns

`id,parent_id,type,title,description,labels,priority,status,feature` (labels `;`-separated)

## Jira JSON shape

```json
{
  "version": 1,
  "items": [
    {
      "sourceId": "004-effect-ledger-T012",
      "parentSourceId": "004-effect-ledger-US1",
      "fields": {
        "issuetype": { "name": "Sub-task" },
        "summary": "…",
        "description": "…markdown…",
        "priority": { "name": "High" },
        "labels": ["004-effect-ledger", "us1", "parallel"]
      }
    }
  ]
}
```

Malformed task line error: `specs/<f>/tasks.md:<line>: expected "- [ ] T### [P?] [USn?] description"`.
