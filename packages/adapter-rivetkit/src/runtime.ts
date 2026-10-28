import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	type ChildChannel,
	forkChild,
	processKillStrategy,
	relayRun,
	resolveScenarioModule,
	type SpawnChild,
} from "@replayguard/adapter-workflows";
import {
	ConfigError,
	DEFAULT_STRATEGIES,
	type PersistenceControl,
	type RuntimeCase,
	type WorkflowRuntime,
} from "@replayguard/core";
import { findEnginePort, killEngine } from "./engine.js";

/** Options for the RivetKit actor runtime. */
export interface RivetKitRuntimeOptions {
	/** Module (path or file URL) exporting a function that returns the built scenario. */
	scenarioModule: string | URL;
	/** Export name of that function (default `scenarioFactory`). */
	exportName?: string;
	/** The scenario module must live inside this directory (default `process.cwd()`). */
	projectRoot?: string;
	/** Where per-case storage directories are created (default OS temp dir). */
	tempDir?: string;
	/** Engine base port; the engine binds P, P+1 and P+10 (default: first free block ≥ 7420). */
	enginePort?: number;
	/** Host entry file (default: the bundled `host/host-entry.js`). */
	hostEntry?: string;
	/** Process spawner (default `forkChild`). */
	spawn?: SpawnChild;
	/** Engine killer used on dispose (default: SIGKILL the PID in the engine's runtime.json). */
	killEngine?: (storageDir: string) => unknown;
}

class HostPersistence implements PersistenceControl {
	crashed = false;
	readonly writeCount = 0;

	crash(): void {
		this.crashed = true;
	}

	restart(): void {
		this.crashed = false;
	}

	onBeforeWrite(): () => void {
		return () => undefined;
	}
}

const defaultHostEntry = () => fileURLToPath(new URL("./host/host-entry.js", import.meta.url));

/**
 * Runs each case on a real RivetKit workflow actor. Every run is a host process with the actor
 * registry; the engine starts with the first host and keeps running when a host is killed, so a
 * crash-style fault kills the host at the anchored effect and the next run starts a new host that
 * picks the actor back up from its persisted history (spike `actor-restart`).
 *
 * Requires a working RivetKit runtime (Linux or macOS for rivetkit 2.3.x).
 *
 * @example
 * // checkout.actor.mjs
 * export const scenarioFactory = () =>
 *   scenario().runtime(rivetkitRuntime({ scenarioModule: import.meta.url }))
 *     .effects(...).workflow((fx) => actorWorkflow(async (ctx) => { ... })).build();
 */
export function rivetkitRuntime(options: RivetKitRuntimeOptions): WorkflowRuntime {
	const spawn = options.spawn ?? forkChild;
	const exportName = options.exportName ?? "scenarioFactory";
	const stopEngine = options.killEngine ?? ((dir: string) => killEngine(dir));
	return {
		name: "rivetkit (actor)",
		processIsolated: true,
		strategies: [...DEFAULT_STRATEGIES, processKillStrategy],
		async prepareCase(input): Promise<RuntimeCase> {
			for (const spec of input.faults) {
				if ("anchor" in spec && spec.anchor.type === "write") {
					throw new ConfigError(
						"durable-write anchors are not supported by the RivetKit runtime",
						"RG_CONFIG_RIVETKIT",
					);
				}
			}
			const modulePath = resolveScenarioModule(
				options.scenarioModule,
				options.projectRoot ?? process.cwd(),
			);
			const storageDir = mkdtempSync(join(options.tempDir ?? tmpdir(), "replayguard-actor-"));
			const enginePort = options.enginePort ?? (await findEnginePort());
			const entry = options.hostEntry ?? defaultHostEntry();
			const persistence = new HostPersistence();
			const hosts: ChildChannel[] = [];

			return {
				persistence,
				runOnce() {
					const host = spawn(entry);
					hosts.push(host);
					return relayRun(host, input.ledger, persistence, {
						type: "init",
						caseIndex: input.caseIndex,
						workflowId: input.workflowId,
						storageDir,
						enginePort,
						scenarioModule: pathToFileURL(modulePath).href,
						exportName,
						...(input.input === undefined ? {} : { input: input.input }),
					});
				},
				async dispose() {
					for (const host of hosts) host.kill();
					try {
						stopEngine(storageDir);
					} finally {
						rmSync(storageDir, { recursive: true, force: true });
					}
				},
			};
		},
	};
}
