# Contract: RivetKit Runtime (`@replayguard/adapter-rivetkit`)

```ts
export function rivetkitRuntime(options: {
  scenarioModule: string | URL;   // exports scenarioFactory and the workflow actor definition
  actorName: string;              // key in the registry `use` map
  startupTimeoutMs?: number;
}): WorkflowRuntime;

// test support (adapter-workflows/test-support)
export function runtimeConformanceSuite(name: string,
  makeRuntime: () => WorkflowRuntime, cases?: ConformanceCase[]): void;
```
