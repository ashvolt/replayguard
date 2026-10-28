import type { ClassifiedResult, RunOptions, ScenarioResult } from "@replayguard/core";

/** A built actor scenario. */
export interface ActorScenario {
	run(options: RunOptions & { classify: true }): Promise<ClassifiedResult>;
	run(options?: RunOptions): Promise<ScenarioResult>;
}

export declare const case0: () => ActorScenario;
export declare const case1: () => ActorScenario;
export declare const case2: () => ActorScenario;
export declare const case3: () => ActorScenario;
export declare const case4: () => ActorScenario;
export declare const case5: () => ActorScenario;
export declare const baselineOnly: () => ActorScenario;
export declare const killAfterCharge: () => ActorScenario;
export declare const sleepThenCharge: () => ActorScenario;
