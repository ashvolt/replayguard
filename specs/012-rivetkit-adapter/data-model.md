# Data Model: RivetKit Adapter

## ActorHostConfig

`{ scenarioModule: string, storageDir: string, enginePort: number, startupTimeoutMs = 20000,
shutdownGraceMs = 5000 }`

## ActorHostState

`"idle" → "starting" → "ready" → ("killed" | "stopped") → "starting" (restart) … → "disposed"`

## ConformanceCase

`{ name, scenarioFactory, expect: { finalState, outcomes: Record<identity, Outcome> } }` —
reference scenarios: H0, H1, H1b, H3a, H3b, H4, baseline clean.
