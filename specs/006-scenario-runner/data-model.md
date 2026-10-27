# Data Model: Scenario Runner

## ScenarioDefinition

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1–120 chars, default `"scenario"` |
| `runtime` | WorkflowRuntime | required |
| `workflowId` | string | 1–200 chars, default `"replayguard-wf"` |
| `effects` | `(ctx: EffectContext) => TEffects` | required |
| `workflow` | `(effects: TEffects) => unknown` (runtime-specific workflow fn) | required |
| `input` | TInput | optional |
| `cases` | `{ name: string; faults: FaultSpec[] }[]` | names unique |
| `explore` | ExploreOptions \| false | default `false` |
| `budget` | `{ maxRuns: 1–1000 = 20, caseTimeoutMs: 1–600000 = 10000, graceMs: 0–10000 = 25 }` | |
| `seed` | integer | default 1 |
| `messages` | `{ name: string; body: unknown; afterRun?: number }[]` | optional scripted deliveries |

## ExploreOptions

`{ strategies: ("crash"|"throwAfter"|"delay"|"processKill")[] = ["crash","throwAfter"],
points: ("after"|"before")[] = ["after","before"], maxCases: 1–500 = 50, delayMs?: number,
kinds?: string[] }`

## RunOutcome

`{ state: "completed", output } | { state: "failed", error: SerializedError } |
{ state: "crashed" } | { state: "sleeping", wakeAt: number } | { state: "waiting", names: string[] }`

## CaseResult

| Field | Type |
|---|---|
| `index` | number (0 = baseline) |
| `name` | string (`baseline`, explicit name, or generated `crash@after:payment#1`) |
| `origin` | `"baseline" \| "explicit" \| "explored"` |
| `faults` | FaultSpec[] |
| `faultOutcomes` | FaultOutcome[] |
| `status` | `"settled" \| "budget-exceeded" \| "harness-error"` |
| `final` | RunOutcome \| undefined |
| `runs` / `restarts` | number |
| `durationMs` | number |
| `ledger` | LedgerSnapshot |
| `harnessError` | SerializedError \| undefined |

## ScenarioResult

`{ version: 1, scenario: { name, runtime, workflowId, seed }, baseline: CaseResult,
cases: CaseResult[], skipped: { name, faults }[], startedAt, durationMs }`

State: Builder → `ScenarioDefinition` (immutable) → `ScenarioRunner.run()` → `ScenarioResult`.
