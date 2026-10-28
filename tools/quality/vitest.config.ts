import { defineVitestConfig } from "@replayguard-tools/config/vitest";

export default defineVitestConfig({ test: { testTimeout: 30_000 } });
