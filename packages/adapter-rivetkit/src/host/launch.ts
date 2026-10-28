/* v8 ignore start -- needs a working RivetKit runtime and engine binary (Linux/macOS only for
   rivetkit 2.3.x); covered by the *.actor.test.ts integration suites, not by unit coverage. */
import { actor, setup } from "rivetkit";
import { createClient } from "rivetkit/client";
import { workflow } from "rivetkit/workflow";
import type { ActorLaunchParams } from "./actor-host.js";

const PING = "__replayguardPing";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Hosts the workflow actor with RivetKit: registry in test mode (default runner pool), engine
 * started on the scenario's port (or attached to the one a previous host left running), and a
 * client call that creates or wakes the actor. Settings come from spike `actor-restart`.
 *
 * @example
 * await launchRivetKitActor(params);
 */
export async function launchRivetKitActor(params: ActorLaunchParams): Promise<void> {
	process.env["RIVETKIT_STORAGE_PATH"] = params.storageDir;
	const { actions, ...options } = params.config;
	const definition = actor({
		...options,
		run: workflow(async (ctx) => params.run(ctx), {
			onError: (_c, event) => params.onError(event as never),
		}),
		actions: { ...(actions ?? {}), [PING]: () => true },
	} as never);
	const registry = setup({
		use: { [params.actorName]: definition },
		startEngine: true,
		enginePort: params.enginePort,
		startServices: false,
		noWelcome: true,
		logging: { level: "warn" },
		shutdown: { disableSignalHandlers: true },
	} as never);
	// Same as rivetkit/test setupTest(): test mode configures the default runner pool.
	registry.config.test = { ...registry.config.test, enabled: true };
	registry.start();
	for (let attempt = 0; ; attempt++) {
		try {
			if ((await registry.routes.health()).ok) break;
		} catch {
			// engine still starting
		}
		if (attempt >= 600) throw new Error("RivetKit registry did not become healthy in 60 s");
		await sleep(100);
	}
	const config = registry.parseConfig();
	const client = createClient({
		endpoint: config.endpoint,
		token: config.token,
		namespace: config.namespace,
		poolName: config.envoy.poolName,
		headers: config.headers,
		encoding: "bare",
	} as never) as unknown as Record<
		string,
		{ getOrCreate(key: string[], options: unknown): Record<string, () => Promise<unknown>> }
	>;
	const handle = client[params.actorName]?.getOrCreate(params.key, {
		createWithInput: params.input,
	});
	// The runner pool can take a moment to register after the registry is healthy.
	for (let attempt = 0; ; attempt++) {
		try {
			await handle?.[PING]?.();
			return;
		} catch (error) {
			if (attempt >= 120) throw error;
			await sleep(500);
		}
	}
}
/* v8 ignore stop */
