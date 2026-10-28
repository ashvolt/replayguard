import type { ViteUserConfig } from "vitest/config";

/** Constitution Principle II: per-package coverage gate. */
export declare const COVERAGE_THRESHOLDS: {
	readonly lines: 90;
	readonly branches: 90;
	readonly functions: 90;
	readonly statements: 90;
};

/**
 * Shared test config with enforced coverage thresholds.
 *
 * @example
 * export default defineVitestConfig({ test: { testTimeout: 20_000 } });
 */
export declare function defineVitestConfig(overrides?: ViteUserConfig): ViteUserConfig;
