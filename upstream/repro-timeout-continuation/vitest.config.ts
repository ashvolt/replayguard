import { defineConfig } from "vitest/config";

// `vitest --mode gap` sets EXPECT_GAP=1: assert today's behavior instead of the expected one.
export default defineConfig(({ mode }) => ({
	test: {
		include: ["test/**/*.test.ts"],
		testTimeout: 30_000,
		env: mode === "gap" ? { EXPECT_GAP: "1" } : {},
	},
}));
