import { defineVitestConfig } from "@replayguard-tools/config/vitest";

export default defineVitestConfig({
	test: {
		// Actor suites start real RivetKit engines; run files one at a time.
		fileParallelism: false,
	},
});
