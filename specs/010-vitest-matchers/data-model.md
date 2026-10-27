# Data Model: Vitest Matchers

## Violation

`{ caseName, identity, kind, subject, outcome, verdict, explanation }`

## Matcher semantics

| Matcher | Fails when |
|---|---|
| `toPassSideEffectPolicy(policy?)` | any effect verdict `fail` (re-classified with `policy` when given and input is `ClassifiedResult`) |
| `toHaveNoDuplicateEffects()` | any outcome `duplicated` or `concurrent-duplicate` |
| `toHaveNoOrphanedEffects()` | any outcome `orphaned` |
| `toBeEffectivelyOnce(selector)` | any selected effect outcome ∉ {`exactly-once`, `deduplicated`}, or no effect selected |
| `toHaveOutcome(selector, outcome)` | no selected effect has `outcome` in any case |

Message: header line, then up to 20 violations `• <case> › <kind> <subject>: <outcome> — <explanation>`,
then `…and N more`.
