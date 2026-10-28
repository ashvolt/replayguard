# Contract: RivetKit Runtime (`@replayguard/adapter-rivetkit`)

> Amended during implementation (maintainer decision, 2026-10-28). Users hand ReplayGuard a
> workflow function plus actor options instead of a finished actor definition. ReplayGuard
> builds the actor around them with RivetKit's `workflow(fn, { onError })`, because that is
> the only reliable way to see when a workflow completes or fails: a failed RivetKit workflow
> sleeps until woken instead of throwing.

```ts
export function actorWorkflow<TState>(
  fn: (ctx: ActorWorkflowContext<TState>) => Promise<unknown>,   // RivetKit workflow body
  config?: { state?: TState; actions?: Record<string, Function>; [option: string]: unknown },
): ActorWorkflow<TState>;

export function rivetkitRuntime(options: {
  scenarioModule: string | URL;   // module exporting the scenario factory (loaded by each host)
  exportName?: string;            // default "scenarioFactory"
  projectRoot?: string;           // scenario module must be inside (default cwd)
  tempDir?: string;               // per-case storage root (default OS temp dir)
  enginePort?: number;            // engine binds P, P+1, P+10 (default: first free block >= 7420)
}): WorkflowRuntime;
// The scenario's .workflow((effects) => actorWorkflow(...)) must return an ActorWorkflow.

// test support (adapter-workflows/test-support)
export function runtimeConformanceSuite(name: string,
  scenarioFor: (c: ConformanceCase) => { run(o: { classify: true }): Promise<ClassifiedResult> },
  options?: { timeoutMs?: number; cases?: readonly ConformanceCase[]; skip?: string }): void;
```
