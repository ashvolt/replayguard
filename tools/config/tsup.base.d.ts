import type { Options } from "tsup";

/**
 * Shared library build: ESM + CJS + declarations, Node 22 target, no code splitting.
 *
 * @example
 * export default defineTsupConfig({ entry: ["src/index.ts", "src/setup.ts"] });
 */
export declare function defineTsupConfig(
	overrides?: Options,
): ReturnType<typeof import("tsup").defineConfig>;
