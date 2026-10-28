import { defineConfig, mergeConfig } from "vitest/config";

/** Constitution Principle II: per-package coverage gate. */
export const COVERAGE_THRESHOLDS = { lines: 90, branches: 90, functions: 90, statements: 90 };

/**
 * Shared test config with enforced coverage thresholds.
 * Plain JavaScript so config loaders can import it from node_modules without type stripping.
 *
 * @param {import("vitest/config").ViteUserConfig} [overrides]
 */
export function defineVitestConfig(overrides = {}) {
	return mergeConfig(
		defineConfig({
			test: {
				include: ["test/**/*.test.ts"],
				coverage: {
					provider: "v8",
					include: ["src/**/*.ts"],
					exclude: ["src/**/*.d.ts"],
					reporter: ["text-summary", "json-summary", "html"],
					thresholds: COVERAGE_THRESHOLDS,
				},
			},
		}),
		overrides,
	);
}
