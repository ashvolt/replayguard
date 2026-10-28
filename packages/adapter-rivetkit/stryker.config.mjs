import base from "@replayguard-tools/config/stryker" with { type: "json" };

/**
 * The RivetKit launcher and host entry need a real engine (Linux/macOS, opt-in actor suites), so
 * the unit-test mutation run cannot exercise them; they are covered by the CI `rivetkit` job.
 * @type {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export default {
	...base,
	mutate: [...base.mutate, "!src/host/launch.ts", "!src/host/host-entry.ts"],
};
