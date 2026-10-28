import base from "@replayguard-tools/config/stryker" with { type: "json" };

/**
 * Constitution Principle II: the fault engine and classifier carry a higher mutation bar.
 * @type {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export default {
	...base,
	mutate: ["src/faults/**/*.ts", "src/classifier/**/*.ts", "src/index.ts"],
	thresholds: { high: 95, low: 90, break: 85 },
	incrementalFile: "reports/stryker-critical-incremental.json",
	htmlReporter: { fileName: "reports/mutation-critical/index.html" },
	jsonReporter: { fileName: "reports/mutation-critical/mutation.json" },
};
