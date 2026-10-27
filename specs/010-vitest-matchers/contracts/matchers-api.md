# Contract: Matchers (`@replayguard/vitest`)

```ts
export interface ReplayGuardMatchers<R = unknown> {
  toPassSideEffectPolicy(policy?: Policy): R;
  toHaveNoDuplicateEffects(): R;
  toHaveNoOrphanedEffects(): R;
  toBeEffectivelyOnce(selector: EffectSelector): R;
  toHaveOutcome(selector: EffectSelector, outcome: Outcome): R;
}
export type EffectSelector = string | ((effect: EffectReport) => boolean);
export const replayGuardMatchers: Record<keyof ReplayGuardMatchers, MatcherFn>;
```

Subpath `@replayguard/vitest/setup` registers matchers on import.
