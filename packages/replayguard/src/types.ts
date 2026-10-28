import type { ReplayGuardMatchers } from "@replayguard/vitest";

// Same augmentation as @replayguard/vitest, declared against the `vitest` this package resolves;
// identical declarations merge, so this is harmless when both resolve to one install.
declare module "vitest" {
	// biome-ignore lint/suspicious/noExplicitAny: mirrors Vitest's own `Matchers<T = any>` declaration
	interface Matchers<T = any> extends ReplayGuardMatchers<T> {}
}
