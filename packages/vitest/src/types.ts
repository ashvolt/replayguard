import type { ReplayGuardMatchers } from "./matchers.js";

declare module "vitest" {
	// biome-ignore lint/suspicious/noExplicitAny: mirrors Vitest's own `Matchers<T = any>` declaration
	interface Matchers<T = any> extends ReplayGuardMatchers<T> {}
}
