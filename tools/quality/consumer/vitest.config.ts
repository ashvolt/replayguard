import { defineConfig } from "vitest/config";
export default defineConfig({
	test: { setupFiles: ["replayguard/setup"], include: ["*.test.ts"] },
});
