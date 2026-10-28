import { fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	ConfigError,
	createCrashStrategy,
	DEFAULT_STRATEGIES,
	type FaultStrategy,
	type PersistenceControl,
	type RuntimeCase,
	type WorkflowRuntime,
} from "@replayguard/core";
import type { EngineWorkflow } from "../runtime.js";
import { type ChildChannel, relayRun, resolveScenarioModule } from "./relay.js";

export type { ChildChannel } from "./relay.js";

/** Starts a child host from an entry file. */
export type SpawnChild = (entry: string) => ChildChannel;

/**
 * Default spawner: `fork` without a shell, no inherited exec arguments, IPC channel only.
 *
 * @example
 * const child = forkChild(entryPath);
 */
export const forkChild: SpawnChild = (entry) => {
	const child = fork(entry, [], { execArgv: [], stdio: ["ignore", "inherit", "inherit", "ipc"] });
	return {
		send: (message) => {
			if (child.connected) child.send(message);
		},
		onMessage: (listener) => {
			child.on("message", listener);
		},
		onExit: (listener) => {
			child.on("exit", (code) => listener(code));
		},
		kill: () => {
			child.kill("SIGKILL");
		},
	};
};

/** Process-isolated kill at an effect: same semantics as `crash`, but the OS process dies. */
export const processKillStrategy: FaultStrategy = createCrashStrategy("processKill", true);

/** Options for the process-isolated runtime. */
export interface ProcessRuntimeOptions {
	/** Module (path or file URL) exporting a function that returns the built scenario. */
	scenarioModule: string | URL;
	/** Export name of that function (default `scenarioFactory`). */
	exportName?: string;
	/** The scenario module must live inside this directory (default `process.cwd()`). */
	projectRoot?: string;
	/** Where per-case storage directories are created (default OS temp dir). */
	tempDir?: string;
	/** Child entry file (default: the bundled `process/child-entry.js`). */
	childEntry?: string;
	/** Process spawner (default `forkChild`). */
	spawn?: SpawnChild;
}

class ProcessPersistence implements PersistenceControl {
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

const defaultChildEntry = () => fileURLToPath(new URL("./process/child-entry.js", import.meta.url));

/**
 * Runs each workflow run in a separate Node.js process on a file-backed store. Crash-style faults
 * kill the process at the anchored effect; the next run starts a fresh process on the same store.
 * Effect checkpoints are serialized through the parent, so every in-process strategy also works.
 *
 * @example
 * // checkout.scenario.mjs
 * export const scenarioFactory = () =>
 *   scenario().runtime(workflowsProcessRuntime({ scenarioModule: import.meta.url })) ... .build();
 */
export function workflowsProcessRuntime(
	options: ProcessRuntimeOptions,
): WorkflowRuntime<EngineWorkflow> {
	const spawn = options.spawn ?? forkChild;
	const exportName = options.exportName ?? "scenarioFactory";
	return {
		name: "@rivet-dev/workflows (process)",
		processIsolated: true,
		strategies: [...DEFAULT_STRATEGIES, processKillStrategy],
		async prepareCase(input): Promise<RuntimeCase> {
			for (const spec of input.faults) {
				if ("anchor" in spec && spec.anchor.type === "write") {
					throw new ConfigError(
						"durable-write anchors are not supported by the process runtime",
						"RG_CONFIG_PROCESS",
					);
				}
			}
			const modulePath = resolveScenarioModule(
				options.scenarioModule,
				options.projectRoot ?? process.cwd(),
			);
			const storeDir = mkdtempSync(join(options.tempDir ?? tmpdir(), "replayguard-"));
			const entry = options.childEntry ?? defaultChildEntry();
			const persistence = new ProcessPersistence();
			let current: ChildChannel | undefined;

			const runOnce = () => {
				const child = spawn(entry);
				current = child;
				return relayRun(child, input.ledger, persistence, {
					type: "init",
					caseIndex: input.caseIndex,
					workflowId: input.workflowId,
					storeDir,
					scenarioModule: pathToFileURL(modulePath).href,
					exportName,
					input: input.input,
				});
			};

			return {
				persistence,
				runOnce,
				async dispose() {
					current?.kill();
					rmSync(storeDir, { recursive: true, force: true });
				},
			};
		},
	};
}
