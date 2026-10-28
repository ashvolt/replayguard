import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	ConfigError,
	type EffectHooks,
	type EffectLedger,
	HarnessError,
	type PendingCall,
	type RunOutcome,
	type SerializedError,
	serializeError,
} from "@replayguard/core";
import * as v from "valibot";
import { type ChildMessage, type ContinueMessage, parseChildMessage } from "./protocol.js";

/** A host-specific `init` message: the discriminator plus the host's own fields. */
export interface InitEnvelope extends Record<string, unknown> {
	/** Discriminator. */
	type: "init";
}

/** A message from the parent: `init` (host-specific fields) or `continue`. */
export type ParentEnvelope = ContinueMessage | InitEnvelope;

/** A running child process, as seen by the parent. */
export interface ChildChannel {
	/** Sends a message to the child. */
	send(message: ParentEnvelope): void;
	/** Registers the handler for child messages. */
	onMessage(listener: (raw: unknown) => void): void;
	/** Registers the handler for child exit. */
	onExit(listener: (code: number | null) => void): void;
	/** Forcibly terminates the child. */
	kill(): void;
}

/** Transport between a child host and its parent. */
export interface ChildIo {
	/** Sends a message; resolves once it is handed to the transport. */
	send(message: ChildMessage): Promise<void>;
	/** Registers the handler for parent messages. */
	onMessage(listener: (raw: unknown) => void): void;
}

/**
 * Resolves a scenario module path or file URL and checks it lies inside `root`.
 *
 * @example
 * const path = resolveScenarioModule(import.meta.url, process.cwd());
 */
export function resolveScenarioModule(module: string | URL, root: string): string {
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

/**
 * Parent side of one run: sends `init`, mirrors the child's effect checkpoints into `ledger`, runs
 * the fault hooks and answers each checkpoint. A hook that crashes the run kills the child.
 *
 * Checkpoints are ordered per call, not globally, so a hook that delays one call (a hanging
 * provider) does not block others. The outcome resolves as soon as the child reports it; effects
 * still in flight (e.g. after a step timeout) keep being mirrored until they settle, as in the
 * in-process engine.
 *
 * @example
 * const outcome = await relayRun(spawn(entry), ledger, persistence, { type: "init", ... });
 */
export function relayRun(
	child: ChildChannel,
	ledger: EffectLedger,
	persistence: { readonly crashed: boolean },
	init: InitEnvelope,
): Promise<RunOutcome> {
	return new Promise<RunOutcome>((resolveRun, rejectRun) => {
		const calls = new Map<number, PendingCall>();
		const seqs = new Map<number, number>();
		const callOfSeq = new Map<number, number>();
		const chains = new Map<number, Promise<void>>();
		let done = false;
		let killed = false;
		const finish = (fn: () => void) => {
			if (!done) {
				done = true;
				fn();
			}
		};
		const fail = (error: unknown) => {
			child.kill();
			finish(() => rejectRun(error));
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
		const enqueue = (call: number, work: () => Promise<void>) => {
			const next = (chains.get(call) ?? Promise.resolve()).then(work).catch(fail);
			chains.set(call, next);
		};
		const handle = (message: ChildMessage) => {
			switch (message.type) {
				case "before-start":
					enqueue(message.token, async () => {
						const call = ledger.pendingCall(message.kind, message.subject, message.idempotencyKey);
						calls.set(message.token, call);
						await runHooks(message.token, (h) => h.beforeStart?.(call));
					});
					return;
				case "in-flight":
					callOfSeq.set(message.seq, message.call);
					enqueue(message.call, async () => {
						const call = calls.get(message.call);
						if (!call) throw new HarnessError(`unknown call token ${message.call}`);
						const attempt = ledger.beginAttempt(call, undefined);
						seqs.set(message.seq, attempt.seq);
						await runHooks(message.token, (h) => h.inFlight?.(attempt));
					});
					return;
				case "after-settle":
					enqueue(callOfSeq.get(message.seq) ?? -1, async () => {
						const seq = seqs.get(message.seq);
						if (seq === undefined) throw new HarnessError(`unknown attempt ${message.seq}`);
						ledger.settleAttempt(seq, message.status, message.error);
						const attempt = ledger.attempts()[seq - 1];
						await runHooks(message.token, (h) => (attempt ? h.afterSettle?.(attempt) : undefined));
					});
					return;
				case "run-ended": {
					const { outcome } = message;
					finish(() =>
						resolveRun(
							outcome.state === "completed"
								? { state: "completed", output: outcome.output }
								: outcome,
						),
					);
					return;
				}
				case "harness-error":
					finish(() => rejectRun(new HarnessError(`child host failed: ${message.message}`)));
					return;
			}
		};
		child.onMessage((raw) => {
			try {
				handle(parseChildMessage(raw));
			} catch (error) {
				fail(error);
			}
		});
		child.onExit((code) => {
			if (killed) {
				finish(() => resolveRun({ state: "crashed" }));
				return;
			}
			// Let checkpoints already received finish first (e.g. a run-ended still in flight).
			void Promise.allSettled([...chains.values()]).then(() =>
				finish(() =>
					rejectRun(
						new HarnessError(
							`child process exited (code ${String(code)}) before reporting a result`,
						),
					),
				),
			);
		});
		child.send(init);
	});
}

const Continue = v.strictObject({
	type: v.literal("continue"),
	token: v.pipe(v.number(), v.integer(), v.minValue(0)),
	error: v.exactOptional(
		v.strictObject({ name: v.string(), message: v.string(), code: v.exactOptional(v.string()) }),
	),
});

function revive(error: SerializedError): Error {
	const revived = new Error(error.message);
	revived.name = error.name;
	if (error.code !== undefined) Object.assign(revived, { code: error.code });
	return revived;
}

/** Child side of the checkpoint protocol. */
export interface CheckpointClient {
	/** The parent's `init` message (validated by the host). */
	init: Promise<unknown>;
	/** Ledger hooks that pause at each effect until the parent answers. */
	hooks: EffectHooks;
	/** Resolves once no effect is between its start and its settle checkpoint. */
	settled(): Promise<void>;
}

/**
 * Child side: resolves the parent's `init` and provides ledger hooks that report every effect
 * checkpoint and wait for the parent's answer (throwing the parent's error, if any).
 *
 * @example
 * const { init, hooks } = createCheckpointClient(io);
 * ledger.addHooks(hooks);
 */
export function createCheckpointClient(io: ChildIo): CheckpointClient {
	const replies = new Map<number, (error: SerializedError | undefined) => void>();
	let token = 0;
	const init = new Promise<unknown>((resolveInit, rejectInit) => {
		io.onMessage((raw) => {
			if ((raw as { type?: unknown } | null)?.type === "init") {
				resolveInit(raw);
				return;
			}
			const parsed = v.safeParse(Continue, raw);
			if (!parsed.success) {
				rejectInit(
					new HarnessError(`invalid IPC message from parent: ${parsed.issues[0]?.message}`),
				);
				return;
			}
			replies.get(parsed.output.token)?.(parsed.output.error);
			replies.delete(parsed.output.token);
		});
	});
	const checkpoint = async (message: Record<string, unknown>): Promise<number> => {
		const t = ++token;
		const reply = new Promise<SerializedError | undefined>((r) => replies.set(t, r));
		await io.send({ ...message, token: t } as ChildMessage);
		const error = await reply;
		if (error) throw revive(error);
		return t;
	};
	const calls = new Map<string, number>();
	const callKey = (c: { identity: string; identityOccurrence: number }) =>
		`${c.identity}#${c.identityOccurrence}`;
	let active = 0;
	let idle: (() => void)[] = [];
	const release = () => {
		active--;
		if (active === 0) {
			for (const resolveIdle of idle) resolveIdle();
			idle = [];
		}
	};
	return {
		init,
		settled: () => (active === 0 ? Promise.resolve() : new Promise<void>((r) => idle.push(r))),
		hooks: {
			async beforeStart(call) {
				active++;
				try {
					const t = await checkpoint({
						type: "before-start",
						kind: call.kind,
						subject: call.subject,
						...(call.idempotencyKey === undefined ? {} : { idempotencyKey: call.idempotencyKey }),
					});
					calls.set(callKey(call), t);
				} catch (error) {
					release(); // the effect will not start, so no settle checkpoint follows
					throw error;
				}
			},
			async inFlight(attempt) {
				await checkpoint({
					type: "in-flight",
					call: calls.get(callKey(attempt)) ?? 0,
					seq: attempt.seq,
				});
			},
			async afterSettle(attempt) {
				try {
					await checkpoint({
						type: "after-settle",
						seq: attempt.seq,
						status: attempt.status === "started" ? "failed" : attempt.status,
						...(attempt.error === undefined ? {} : { error: attempt.error }),
					});
				} finally {
					release();
				}
			},
		},
	};
}
