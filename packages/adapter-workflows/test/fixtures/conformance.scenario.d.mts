import type { ClassifiedResult, RunOptions } from "@replayguard/core";

/** A built conformance scenario (process runtime). */
export interface ConformanceScenario {
	run(options: RunOptions & { classify: true }): Promise<ClassifiedResult>;
}

export declare const case0: () => ConformanceScenario;
export declare const case1: () => ConformanceScenario;
export declare const case2: () => ConformanceScenario;
export declare const case3: () => ConformanceScenario;
export declare const case4: () => ConformanceScenario;
export declare const case5: () => ConformanceScenario;
