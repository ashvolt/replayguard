import { fork } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	ConfigError,
	createCrashStrategy,
	DEFAULT_STRATEGIES,
	type EffectHooks,
	type FaultStrategy,
	HarnessError,
	type PendingCall,
	type PersistenceControl,
	type RunOutcome,
	type RuntimeCase,
	serializeError,
	type WorkflowRuntime,
} from "@replayguard/core";
import type { EngineWorkflow } from "../runtime.js";
import { type ParentMessage, parseChildMessage } from "./protocol.js";

/** A running child process, as seen by the parent. */
export interface ChildChannel {
	/** Sends a message to the child. */
	send(message: ParentMessage): void;
	/** Registers the handler for child messages. */
	onMessage(listener: (raw: unknown) => void): void;
	/** Registers the handler for child exit. */
	onExit(listener: (code: number | null) => void): void;
	/** Forcibly terminates the child. */
	kill(): void;
}

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

function resolveModule(module: string | URL, root: string): string {
	const path =
		module instanceof URL || module.startsWith("file:") ? fileURLToPath(module) : resolve(module);
	if (!existsSync(path))
		throw new ConfigError(`scenario module not found: ${path}`, "RG_CONFIG_PROCESS");
	const rel = relative(realpathSync(root), realpathSync(path));
	if (rel.startsWith("..") || isAbsolute(rel)) {
		throw new ConfigError("scenario module must be inside the project root", "RG_CONFIG_PROCESS");
	}
	return path;
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
			const modulePath = resolveModule(
				options.scenarioModule,
				options.projectRoot ?? process.cwd(),
			);
			const storeDir = mkdtempSync(join(options.tempDir ?? tmpdir(), "replayguard-"));
			const entry = options.childEntry ?? defaultChildEntry();
			const persistence = new ProcessPersistence();
			const { ledger } = input;
			let current: ChildChannel | undefined;

			const runOnce = () =>
				new Promise<RunOutcome>((resolveRun, rejectRun) => {
					const child = spawn(entry);
					current = child;
					const calls = new Map<number, PendingCall>();
					const seqs = new Map<number, number>();
					let done = false;
					let killed = false;
					const finish = (fn: () => void) => {
						if (!done) {
							done = true;
							fn();
						}
					};
					const kill = () => {
						killed = true;
						child.kill();
						finish(() => resolveRun({ state: "crashed" }));
					};
					const runHooks = async (token: number, step: (hooks: EffectHooks) => unknown) => {
						try {
							for (const hooks of ledger.hooks()) await step(hooks);
							child.send({ type: "continue", token });
						} catch (error) {
							if (persistence.crashed) kill();
							else child.send({ type: "continue", token, error: serializeError(error) });
						}
					};
					const handle = async (raw: unknown) => {
						const message = parseChildMessage(raw);
						if (done) return;
						switch (message.type) {
							case "before-start": {
								const call = ledger.pendingCall(
									message.kind,
									message.subject,
									message.idempotencyKey,
								);
								calls.set(message.token, call);
								await runHooks(message.token, (h) => h.beforeStart?.(call));
								return;
							}
							case "in-flight": {
								const call = calls.get(message.call);
								if (!call) throw new HarnessError(`unknown call token ${message.call}`);
								const attempt = ledger.beginAttempt(call, undefined);
								seqs.set(message.seq, attempt.seq);
								await runHooks(message.token, (h) => h.inFlight?.(attempt));
								return;
							}
							case "after-settle": {
								const seq = seqs.get(message.seq);
								if (seq === undefined) throw new HarnessError(`unknown attempt ${message.seq}`);
								ledger.settleAttempt(seq, message.status, message.error);
								const attempt = ledger.attempts()[seq - 1];
								await runHooks(message.token, (h) =>
									attempt ? h.afterSettle?.(attempt) : undefined,
								);
								return;
							}
							case "run-ended":
								finish(() => resolveRun(message.outcome));
								return;
							case "harness-error":
								finish(() => rejectRun(new HarnessError(`child host failed: ${message.message}`)));
								return;
						}
					};
					let queue = Promise.resolve();
					child.onMessage((raw) => {
						queue = queue
							.then(() => handle(raw))
							.catch((error: unknown) => {
								child.kill();
								finish(() => rejectRun(error));
							});
					});
					child.onExit((code) => {
						finish(() =>
							killed
								? resolveRun({ state: "crashed" })
								: rejectRun(
										new HarnessError(
											`child process exited (code ${String(code)}) before reporting a result`,
										),
									),
						);
					});
					child.send({
						type: "init",
						caseIndex: input.caseIndex,
						workflowId: input.workflowId,
						storeDir,
						scenarioModule: pathToFileURL(modulePath).href,
						exportName,
						input: input.input,
					});
				});

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
