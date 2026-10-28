import { defineConfig } from "tsup";

/**
 * Shared library build: ESM + CJS + declarations, Node 22 target, no code splitting.
 * Plain JavaScript so config loaders can import it from node_modules without type stripping.
 *
 * @param {import("tsup").Options} [overrides]
 */
export function defineTsupConfig(overrides = {}) {
	return defineConfig({
		entry: ["src/index.ts"],
		format: ["esm", "cjs"],
		dts: true,
		sourcemap: true,
		clean: true,
		target: "node22",
		treeshake: true,
		splitting: false,
		...overrides,
	});
}
