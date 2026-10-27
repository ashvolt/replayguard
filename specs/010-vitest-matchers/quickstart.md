# Quickstart: Vitest Matchers

```ts
// vitest.config.ts
export default defineConfig({ test: { setupFiles: ["@replayguard/vitest/setup"] } });

// checkout.test.ts
it("charges exactly once under crashes", async () => {
  const result = classify(await checkout.run());
  expect(result).toPassSideEffectPolicy();
  expect(result).toBeEffectivelyOnce("payment");
});
```

## Validation scenarios

- Duplicated payment → `toPassSideEffectPolicy` fails; message names case + `payment.charge`.
- Deduplicated payment → `toBeEffectivelyOnce("payment")` passes.
- `toHaveOutcome("email", "dupe")` → type error.
