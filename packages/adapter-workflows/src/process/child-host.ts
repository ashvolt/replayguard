import {
	createEffectContext,
	EffectLedger,
	HarnessError,
	type ScenarioDefinition,
	type SerializedError,
	systemClock,
	systemSleeper,
} from "@replayguard/core";
import type { EngineDriver } from "@rivet-dev/workflows";
import { FileDriver } from "../file-driver.js";
import { type EngineWorkflow, runEngineOnce } from "../runtime.js";
import { type ChildMessage, type ParentMessage, parseParentMessage } from "./protocol.js";

type Init = Extract<ParentMessage, { type: "init" }>;
type Outgoing = ChildMessage extends infer M
	? M extends { token: number }
		? Omit<M, "token">
		: never
	: never;

/** Transport between the child host and its parent. */
export interface ChildIo {
	/** Sends a message; resolves once it is handed to the transport. */
	send(message: ChildMessage): Promise<void>;
	/** Registers the handler for parent messages. */
	onMessage(listener: (raw: unknown) => void): void;
}

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

function revive(error: SerializedError): Error {
	const revived = new Error(error.message);
	revived.name = error.name;
	if (error.code !== undefined) Object.assign(revived, { code: error.code });
	return revived;
}

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
	const replies = new Map<number, (error: SerializedError | undefined) => void>();
	let token = 0;
	const initReady = new Promise<Init>((resolve, reject) => {
		io.onMessage((raw) => {
			try {
				const message = parseParentMessage(raw);
				if (message.type === "init") resolve(message);
				else {
					replies.get(message.token)?.(message.error);
					replies.delete(message.token);
				}
			} catch (error) {
				reject(error);
			}
		});
	});
	const checkpoint = async (message: Outgoing): Promise<number> => {
		const t = ++token;
		const reply = new Promise<SerializedError | undefined>((resolve) => replies.set(t, resolve));
		await io.send({ ...message, token: t } as ChildMessage);
		const error = await reply;
		if (error) throw revive(error);
		return t;
	};
	try {
		const init = await initReady;
		const factory = (await deps.importModule(init.scenarioModule))[init.exportName];
		if (typeof factory !== "function") {
			throw new HarnessError(`scenario module does not export a function "${init.exportName}"`);
		}
		const def = (factory() as { definition?: ScenarioDefinition }).definition;
		if (!def || typeof def.effects !== "function" || typeof def.workflow !== "function") {
			throw new HarnessError(`"${init.exportName}" must return a built scenario`);
		}
		const ledger = new EffectLedger();
		const calls = new Map<string, number>();
		const callKey = (c: { identity: string; identityOccurrence: number }) =>
			`${c.identity}#${c.identityOccurrence}`;
		ledger.addHooks({
			async beforeStart(call) {
				const t = await checkpoint({
					type: "before-start",
					kind: call.kind,
					subject: call.subject,
					...(call.idempotencyKey === undefined ? {} : { idempotencyKey: call.idempotencyKey }),
				});
				calls.set(callKey(call), t);
			},
			async inFlight(attempt) {
				await checkpoint({
					type: "in-flight",
					call: calls.get(callKey(attempt)) ?? 0,
					seq: attempt.seq,
				});
			},
			async afterSettle(attempt) {
				await checkpoint({
					type: "after-settle",
					seq: attempt.seq,
					status: attempt.status === "started" ? "failed" : attempt.status,
					...(attempt.error === undefined ? {} : { error: attempt.error }),
				});
			},
		});
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
	} catch (error) {
		await io.send({
			type: "harness-error",
			message: error instanceof Error ? (error.stack ?? error.message) : String(error),
		});
	}
}
