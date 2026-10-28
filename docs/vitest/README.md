# Vitest matchers

`@replayguard/vitest` adds assertions about side effects to Vitest's `expect`. It supports
Vitest 3.2 and 4 (peer range `>=3.2 <5`).

## Setup

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { setupFiles: ["@replayguard/vitest/setup"] } });
```

The setup import registers the matchers and adds their types to `expect`. If you would rather
register them yourself:

```ts
import { replayGuardMatchers } from "@replayguard/vitest";
expect.extend(replayGuardMatchers);
```

## Usage

```ts
it("charges exactly once under crashes", async () => {
  const result = await checkout.run();
  expect(result).toPassSideEffectPolicy();
  expect(result).toBeEffectivelyOnce("payment");
});
```

Each matcher accepts a **scenario result** (`await scenario.run()`), a **classified result**
(`classify(...)`) or a **report** (`buildReport(...)`). A scenario result is classified with the
strict policy unless you pass a policy. Any other value fails with a message that says what was
expected, even under `.not`.

## Matchers

| Matcher | Fails when |
|---|---|
| `toPassSideEffectPolicy(policy?)` | Any effect has verdict `fail`, or a case fails without a failing effect (for example a harness error). With `policy`, scenario and classified results are classified again; reports cannot be. |
| `toHaveNoDuplicateEffects()` | Any effect is `duplicated` or `concurrent-duplicate` |
| `toHaveNoOrphanedEffects()` | Any effect is `orphaned` |
| `toBeEffectivelyOnce(selector)` | A selected effect is not `exactly-once` or `deduplicated`, or no effect matches the selector |
| `toHaveOutcome(selector, outcome)` | No selected effect has `outcome` in any case. `outcome` is type-checked against the outcome names. |

Every matcher supports `.not`.

**Selectors** can take three forms:

- A string, which matches an effect kind exactly or as a `.`/`:` prefix. For example, `"payment"`
  matches `payment` and `payment.charge`, and `"http"` matches `http:POST /orders`. A string can
  also match a full identity, such as `"payment.charge::o-1"`.
- A predicate `(effect) => boolean`.

## Failure messages

A failure message names each offending case and effect, with its outcome and explanation. It
shows the first 20 and counts the rest:

```text
expected side effects to pass the policy, but 1 effect(s) failed:
  • crash after charge › payment.charge o-1: duplicated — payment.charge applied 2× (expected 1). Fault F1 (crash after payment.charge#1) stopped run 0 after the effect applied but before the step result was saved; run 1 re-executed the step.
```

The matchers do not depend on any reporter.
