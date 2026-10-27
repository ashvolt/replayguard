# Data Model: Upstream Proposal

## Reproduction

`{ folder, engineVersion, hypothesis: "H2" | "H3" | "identity", command: "pnpm test" }`

## IssueDraft

`{ title, repo, labels: string[], body: { summary, observed, expected, impact, repro, options,
environment } }`

## TrackerRow (`upstream/README.md` table)

`| Draft | Repro | Status (draft/approved/filed/answered/closed) | Link | Decision |`
