// Type tests: checked by `tsc --noEmit` (check-types), not executed.
import type { Outcome, ScenarioResult } from "@replayguard/core";
import { expect, expectTypeOf } from "vitest";
import type { EffectSelector, ReplayGuardMatchers } from "../src/index.js";
import "../src/setup.js";

declare const result: ScenarioResult;

expect(result).toPassSideEffectPolicy();
expect(result).toPassSideEffectPolicy({ kinds: { email: { duplicated: "warn" } } });
expect(result).toHaveNoDuplicateEffects();
expect(result).not.toHaveNoOrphanedEffects();
expect(result).toBeEffectivelyOnce("payment");
expect(result).toBeEffectivelyOnce((e) => e.kind === "payment");
expect(result).toHaveOutcome("email", "duplicated");

// @ts-expect-error — not an outcome
expect(result).toHaveOutcome("email", "dupe");
// @ts-expect-error — not a verdict
expect(result).toPassSideEffectPolicy({ default: { duplicated: "maybe" } });
// @ts-expect-error — selector is required
expect(result).toBeEffectivelyOnce();

expectTypeOf<Parameters<ReplayGuardMatchers["toHaveOutcome"]>[1]>().toEqualTypeOf<Outcome>();
expectTypeOf<EffectSelector>().toExtend<string | ((...args: never[]) => boolean)>();
