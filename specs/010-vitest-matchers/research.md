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

- **Decision**: `vitest: ">=4 <6"` (current and previous major), tested in CI against both.
