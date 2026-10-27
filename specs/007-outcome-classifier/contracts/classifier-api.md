# Contract: Classifier API (`@replayguard/core`)

```ts
export type Outcome = "exactly-once" | "deduplicated" | "duplicated"
  | "concurrent-duplicate" | "orphaned" | "skipped";
export type VerdictLevel = "pass" | "warn" | "fail";

export const DEFAULT_POLICY: Readonly<Record<Outcome, VerdictLevel>>;
export const OUTCOME_SEVERITY: readonly Outcome[]; // most severe first

export interface OutcomeRule {
  readonly outcome: Outcome;
  isSatisfiedBy(evidence: Evidence): boolean;
}
export const OUTCOME_RULES: readonly OutcomeRule[];

export function classify(result: ScenarioResult, policy?: Policy): ClassifiedResult;
export function resolveVerdict(policy: Policy, kind: string, identity: string,
  outcome: Outcome): VerdictLevel;
```

`Scenario.run()` returns `ScenarioResult`; convenience:
`scenario(...).build().run({ classify: true, policy })` → `ClassifiedResult` (added in 007).
