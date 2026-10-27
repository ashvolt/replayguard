# Contract: Faults API

## `@replayguard/core`

```ts
export type FaultPoint = "before" | "after";
export type FaultAnchor =
  | { type: "effect"; kind: string; occurrence: number }
  | { type: "effect"; identity: string; occurrence: number }
  | { type: "write"; index: number };

export type FaultSpec =
  | { strategy: "none" }
  | { strategy: "crash"; anchor: FaultAnchor; point?: FaultPoint }
  | { strategy: "throwAfter"; anchor: Extract<FaultAnchor, { type: "effect" }>; error?: () => Error }
  | { strategy: "delay"; anchor: Extract<FaultAnchor, { type: "effect" }>; delayMs: number }
  | { strategy: "processKill"; anchor: FaultAnchor; point?: FaultPoint };

// helpers
export const fault: {
  none(): FaultSpec;
  crashAfter(kind: string, occurrence?: number): FaultSpec;
  crashBefore(kind: string, occurrence?: number): FaultSpec;
  crashAtWrite(index: number): FaultSpec;
  loseResponse(kind: string, occurrence?: number, error?: () => Error): FaultSpec;
  delay(kind: string, delayMs: number, occurrence?: number): FaultSpec;
  killAfter(kind: string, occurrence?: number): FaultSpec;
};

export interface FaultEnvironment {
  ledger: EffectLedger;
  persistence: PersistenceControl;
  sleeper: Sleeper;
}

export interface FaultStrategy {
  readonly name: FaultSpec["strategy"];
  readonly requiresProcessIsolation: boolean;
  arm(spec: FaultSpec, env: FaultEnvironment): ArmedFault;
}

export interface ArmedFault {
  outcome(): FaultOutcome;
  dispose(): void;
}

export class FaultController {
  constructor(strategies?: readonly FaultStrategy[]);
  arm(specs: readonly FaultSpec[], env: FaultEnvironment): ArmedFaults; // { outcomes(); dispose() }
}
```

## `@replayguard/adapter-workflows`

```ts
export class FaultyDriver implements EngineDriver, PersistenceControl {
  constructor(inner: EngineDriver);
}
export class FileDriver extends InMemoryDriver {
  static open(dir: string): Promise<FileDriver>;
}
export const processKillStrategy: FaultStrategy;
```
