# Quickstart: Classifier

```ts
import { classify } from "@replayguard/core";

const classified = classify(await myScenario.run(), {
  kinds: { email: { duplicated: "pass" } },
});
classified.verdict;                               // "fail" if any payment duplicated
classified.cases[1].effects[0].outcome;           // "duplicated"
classified.cases[1].effects[0].explanation;
```

## Validation scenarios

| Input (spike) | Expected outcome |
|---|---|
| H1 crash after payment | duplicated |
| H1b with idempotency key | deduplicated |
| H3a delay + retryOnTimeout | concurrent-duplicate |
| H3b delay + critical timeout | orphaned |
| crash before email, completed | exactly-once (re-executed after restart) |
| ephemeral step lost + skip | skipped (synthetic snapshot) |
