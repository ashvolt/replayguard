/**
 * Registers the ReplayGuard matchers with Vitest's `expect` and adds their types.
 *
 * @example
 * // vitest.config.ts
 * export default defineConfig({ test: { setupFiles: ["replayguard/setup"] } });
 */
import "@replayguard/vitest/setup";
import "./types.js";
