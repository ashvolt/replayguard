/**
 * `replayguard`: one import for scenarios, faults, classification, reports, fakes, the
 * idempotency helper and the Vitest matchers. Runtime adapters stay separate packages
 * (`@replayguard/adapter-workflows`, `@replayguard/adapter-rivetkit`).
 *
 * @example
 * import { classify, createFakePayment, fault, idempotencyKey, scenario } from "replayguard";
 */
import "./types.js";

export * from "@replayguard/core";
export * from "@replayguard/fakes";
export * from "@replayguard/vitest";

/**
 * Name of this package, for diagnostics.
 *
 * @example
 * console.log(PACKAGE_NAME); // "replayguard"
 */
export const PACKAGE_NAME = "replayguard";
