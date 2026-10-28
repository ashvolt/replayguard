import {
	createEffectContext,
	EffectLedger,
	HarnessError,
	type ScenarioDefinition,
	systemClock,
	systemSleeper,
} from "@replayguard/core";
import type { EngineDriver } from "@rivet-dev/workflows";
import { FileDriver } from "../file-driver.js";
import { type EngineWorkflow, runEngineOnce } from "../runtime.js";
import { type InitMessage, parseParentMessage } from "./protocol.js";
import { type ChildIo, createCheckpointClient } from "./relay.js";

export type { ChildIo } from "./relay.js";

/** Injectable effects of the child host (module loading and storage). */
export interface ChildHostDeps {
	/** Loads the scenario module. */
	importModule(specifier: string): Promise<Record<string, unknown>>;
	/** Opens durable storage in a directory. */
	openDriver(dir: string): Promise<EngineDriver>;
}

/** Production dependencies: dynamic `import()` and `FileDriver`. */
export const defaultChildDeps: ChildHostDeps = {
	importModule: (specifier) => import(specifier),
	openDriver: (dir) => FileDriver.open(dir),
};

/**
 * Runs one workflow run inside a child process: rebuilds the user's scenario, instruments its
 * effects and pauses at every effect checkpoint until the parent replies `continue` (or kills it).
 *
 * @example
 * void runChildHost({ send, onMessage }); // see child-entry.ts
 */
export async function runChildHost(
	io: ChildIo,
	deps: ChildHostDeps = defaultChildDeps,
): Promise<void> {
	const client = createCheckpointClient(io);
	try {
		// The checkpoint client only resolves `init` for messages typed "init".
		const init = parseParentMessage(await client.init) as InitMessage;
		const factory = (await deps.importModule(init.scenarioModule))[init.exportName];
		if (typeof factory !== "function") {
			throw new HarnessError(`scenario module does not export a function "${init.exportName}"`);
		}
		const def = (factory() as { definition?: ScenarioDefinition }).definition;
		if (!def || typeof def.effects !== "function" || typeof def.workflow !== "function") {
			throw new HarnessError(`"${init.exportName}" must return a built scenario`);
		}
		const ledger = new EffectLedger();
		ledger.addHooks(client.hooks);
		const workflow = def.workflow(
			def.effects(createEffectContext(ledger, systemClock, systemSleeper, init.caseIndex)),
		) as EngineWorkflow;
		const driver = await deps.openDriver(init.storeDir);
		const outcome = await runEngineOnce(init.workflowId, workflow, init.input, driver, () => false);
		await io.send({
			type: "run-ended",
			outcome:
				outcome.state === "crashed"
					? {
							state: "failed",
							error: { name: "CrashSignal", message: "unexpected crash in child" },
						}
					: outcome,
		});
		// Like a real host, keep running effects that outlived the run (e.g. a timed-out call)
		// until they settle; the parent kills the process when the case ends.
		await client.settled();
	} catch (error) {
		await io.send({
			type: "harness-error",
			message: error instanceof Error ? (error.stack ?? error.message) : String(error),
		});
	}
}
