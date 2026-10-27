# Contract: Scenario API

## `@replayguard/core`

```ts
export interface EffectContext {
  readonly ledger: EffectLedger;
  readonly clock: Clock;
  readonly sleeper: Sleeper;
  readonly caseIndex: number;
  instrument<A extends readonly unknown[], R>(fn: (...a: A) => R | Promise<R>,
    options: InstrumentOptions<A, R>): (...a: A) => Promise<R>;
}

export interface WorkflowRuntime<TWorkflow = unknown, TInput = unknown> {
  readonly name: string;
  readonly processIsolated: boolean;
  prepareCase(input: {
    workflowId: string;
    workflow: TWorkflow;
    input: TInput | undefined;
    ledger: EffectLedger;
    caseIndex: number;
  }): Promise<RuntimeCase>;
}

export interface RuntimeCase {
  readonly persistence: PersistenceControl & { restart(): void };
  runOnce(runIndex: number): Promise<RunOutcome>;
  deliver?(name: string, body: unknown): Promise<void>;
  dispose(): Promise<void>;
}

export function scenario(): ScenarioBuilder;

interface ScenarioBuilder<TEffects = never, TWorkflow = never, TInput = undefined> {
  name(name: string): this;
  runtime<W>(runtime: WorkflowRuntime<W>): ScenarioBuilder<TEffects, W, TInput>;
  effects<E>(factory: (ctx: EffectContext) => E): ScenarioBuilder<E, TWorkflow, TInput>;
  workflow(factory: (effects: TEffects) => TWorkflow): this;
  input<I>(input: I): ScenarioBuilder<TEffects, TWorkflow, I>;
  workflowId(id: string): this;
  case(name: string, faults: readonly FaultSpec[]): this;
  faults(faults: readonly FaultSpec[]): this;        // shorthand: one unnamed explicit case
  explore(options?: Partial<ExploreOptions>): this;
  budget(budget: Partial<Budget>): this;
  seed(seed: number): this;
  deliver(name: string, body: unknown, afterRun?: number): this;
  build(): Scenario;                                  // throws ConfigError
}

export interface Scenario {
  readonly definition: Readonly<ScenarioDefinition>;
  run(options?: { clock?: Clock; sleeper?: Sleeper }): Promise<ScenarioResult>;
}
```

## `@replayguard/adapter-workflows`

```ts
export function workflowsRuntime(): WorkflowRuntime<WorkflowFunction<unknown, unknown>>;
export function workflowsProcessRuntime(options: {
  scenarioModule: string | URL;     // module exporting `scenarioFactory: () => Scenario`
  tempDir?: string;
  childTimeoutMs?: number;
}): WorkflowRuntime<WorkflowFunction<unknown, unknown>>;
```
