# Research: Vitest Matchers

## R1 — Extending expect

- **Decision**: `expect.extend({ ... })` in `setup.ts`; users add it to `setupFiles` or import it
  in a test. Matchers return `{ pass, message: () => string, actual?, expected? }`.

## R2 — Type augmentation

- **Decision**:
  ```ts
  declare module "vitest" {
    interface Assertion<T = any> extends ReplayGuardMatchers<T> {}
    interface AsymmetricMatchersContaining extends ReplayGuardMatchers {}
  }
  ```
  (Vitest's documented pattern; `any` here mirrors Vitest's own declaration and is confined to the
  `.d.ts`, allowed as a constitution-documented exception in Complexity Tracking if flagged by
  lint — use `unknown` if Vitest's interface accepts it.)

## R3 — Selectors

- **Decision**: `selector: string | ((e: EffectReport) => boolean)`; a string matches `kind`
  exactly or `kind` prefix ending with `.` (e.g. `"payment"` matches `payment.charge`).

## R4 — Peer range

- **Decision**: `vitest: ">=3.2 <5"` (current major 4 and previous major 3.2), tested in CI
  against both.
- **Amendment (implementation, approved by maintainer)**: the original range `>=4 <6` assumed
  Vitest 5 as the current major. The repo pins Vitest 4 (Stryker's vitest runner cannot activate
  mutants under 5), and Vitest 5 changed the augmentable interface to `Matchers<R, T>` while
  3.2/4 use `Matchers<T>`; one declaration cannot merge with both. Vitest 5 support follows the
  repo's upgrade. The matcher context is typed structurally (`{ isNot }`) because `MatcherState`
  is not exported by Vitest 3.2.
