import {
	CrashSignal,
	EffectLedger,
	FaultController,
	type FaultSpec,
	type LedgerSnapshot,
	systemSleeper,
} from "@replayguard/core";
import { runWorkflow, type WorkflowFunction, type WorkflowResult } from "@rivet-dev/workflows";
import { FaultyDriver } from "../../src/faulty-driver.js";
import { MemoryDriver } from "../../src/memory-driver.js";

export interface HostResult {
	result: WorkflowResult<unknown> | undefined;
	error: unknown;
	runs: number;
	restarts: number;
	ledger: LedgerSnapshot;
}

/**
 * Minimal host loop for acceptance tests (the full runner arrives in feature 006): runs the
 * workflow in yield mode, restarts after simulated crashes, waits out retry backoff.
 */
export async function host(
	build: (ledger: EffectLedger) => WorkflowFunction<undefined, unknown>,
	faults: readonly FaultSpec[],
	options: { maxRuns?: number; graceMs?: number } = {},
): Promise<HostResult> {
	const ledger = new EffectLedger();
	const driver = new FaultyDriver(new MemoryDriver());
	const armed = new FaultController().arm(faults, {
		ledger,
		persistence: driver,
		sleeper: systemSleeper,
		processIsolated: false,
	});
	const workflow = build(ledger);
	let restarts = 0;
	let outcome: { result: WorkflowResult<unknown> | undefined; error: unknown } = {
		result: undefined,
		error: undefined,
	};
	let runs = 0;
	for (; runs < (options.maxRuns ?? 20); ) {
		runs++;
		ledger.beginRun();
		try {
			const result = await runWorkflow("wf-1", workflow, undefined, driver, { mode: "yield" })
				.result;
			if (result.state === "sleeping" && result.sleepUntil !== undefined) {
				ledger.endRun("yielded");
				await systemSleeper.sleep(result.sleepUntil - Date.now() + 1);
				continue;
			}
			ledger.endRun(result.state === "completed" ? "completed" : "waiting");
			outcome = { result, error: undefined };
			break;
		} catch (error) {
			if (driver.crashed || error instanceof CrashSignal) {
				ledger.endRun("crashed");
				driver.restart();
				restarts++;
				continue;
			}
			ledger.endRun("failed");
			outcome = { result: undefined, error };
			break;
		}
	}
	await systemSleeper.sleep(options.graceMs ?? 0);
	armed.dispose();
	return { ...outcome, runs, restarts, ledger: ledger.finalize() };
}
