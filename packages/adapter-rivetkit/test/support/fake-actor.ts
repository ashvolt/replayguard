import type { ChildChannel, ChildIo, SpawnChild } from "@replayguard/adapter-workflows";
import {
	type ActorHostDeps,
	type ActorLaunchParams,
	runActorHost,
} from "../../src/host/actor-host.js";

/**
 * A minimal stand-in for a RivetKit workflow actor: step results are persisted per storage
 * directory once a step finishes, so a host killed mid-step leaves no record and the next host
 * re-executes that step (like the real engine, see spike actor-restart).
 */
export function fakeActorEngine() {
	const histories = new Map<string, Map<string, unknown>>();
	const launches: ActorLaunchParams[] = [];
	const launch = async (params: ActorLaunchParams): Promise<void> => {
		launches.push(params);
		const history = histories.get(params.storageDir) ?? new Map<string, unknown>();
		histories.set(params.storageDir, history);
		const ctx = {
			workflowId: params.key[0],
			async step(
				nameOrConfig: string | { name: string; run: (step: unknown) => Promise<unknown> },
				run?: (step: unknown) => Promise<unknown>,
			) {
				const name = typeof nameOrConfig === "string" ? nameOrConfig : nameOrConfig.name;
				const body = typeof nameOrConfig === "string" ? run : nameOrConfig.run;
				if (history.has(name)) return history.get(name);
				try {
					const result = await body?.({ state: params.config.state });
					history.set(name, result);
					return result;
				} catch (error) {
					params.onError({
						step: {
							willRetry: false,
							error: { name: (error as Error).name, message: (error as Error).message },
						},
					});
					return new Promise(() => undefined); // a failed workflow sleeps until woken
				}
			},
		};
		void params.run(ctx).catch(() => undefined);
	};
	return { launch, launches, histories };
}

/**
 * Spawner running the actor host in this process over an in-memory channel. Killing stops all
 * message delivery, so the host freezes at its current checkpoint — like a dead process.
 */
export function inMemoryActorSpawn(deps: ActorHostDeps): SpawnChild & { spawned: number } {
	const spawn = Object.assign(
		(): ChildChannel => {
			spawn.spawned++;
			const parentListeners: ((raw: unknown) => void)[] = [];
			const exitListeners: ((code: number | null) => void)[] = [];
			let toChild: (raw: unknown) => void = () => undefined;
			let alive = true;
			const exit = (code: number | null) => {
				if (!alive) return;
				alive = false;
				for (const l of exitListeners) l(code);
			};
			const io: ChildIo = {
				async send(message) {
					const copy = JSON.parse(JSON.stringify(message)) as unknown;
					queueMicrotask(() => {
						if (alive) for (const l of parentListeners) l(copy);
					});
				},
				onMessage(listener) {
					toChild = listener;
				},
			};
			void runActorHost(io, deps).then(() => queueMicrotask(() => exit(0)));
			return {
				send(message) {
					const copy = JSON.parse(JSON.stringify(message)) as unknown;
					queueMicrotask(() => {
						if (alive) toChild(copy);
					});
				},
				onMessage: (listener) => {
					parentListeners.push(listener);
				},
				onExit: (listener) => {
					exitListeners.push(listener);
				},
				kill: () => exit(null),
			};
		},
		{ spawned: 0 },
	);
	return spawn;
}
