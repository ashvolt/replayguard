# Contract: Idempotency & Hints (`@replayguard/core`)

```ts
export function idempotencyKey(
  ctx: { readonly workflowId: string },
  step: string,
  options?: IdempotencyKeyOptions,
): string;                                 // throws ConfigError if workflowId/step empty

export interface FixHint { id: string; title: string; explanation: string; example: string }
export interface HintRule { /* see data-model */ }
export const HINT_RULES: readonly HintRule[];
export function attachHints(classified: ClassifiedResult, rules?: readonly HintRule[]): ClassifiedResult;
```
