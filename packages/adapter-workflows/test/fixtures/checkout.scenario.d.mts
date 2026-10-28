import type { Scenario } from "@replayguard/core";

/** Checkout scenario run in real child processes. */
export declare const scenarioFactory: () => Scenario;
/** Scenario whose workflow never settles (budget test). */
export declare const hangingFactory: () => Scenario;
