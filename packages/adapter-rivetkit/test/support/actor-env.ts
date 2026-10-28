/** Why actor integration tests cannot run here, or undefined when they can. */
export const ACTOR_SKIP_REASON: string | undefined =
	process.platform === "win32"
		? "rivetkit 2.3.x has no working Windows runtime (see spikes/actor-restart/FINDINGS.md); run on Linux or macOS"
		: process.env["REPLAYGUARD_ACTOR_TESTS"] !== "1"
			? "set REPLAYGUARD_ACTOR_TESTS=1 to start real RivetKit engines (the CI rivetkit job does)"
			: undefined;
