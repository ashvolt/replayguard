import type { ChildHostDeps, ChildIo } from "../../src/process/child-host.js";
import { runChildHost } from "../../src/process/child-host.js";
import type { ChildChannel, SpawnChild } from "../../src/process/process-runtime.js";

/**
 * Spawner that runs the child host in this process over an in-memory channel. Killing stops all
 * message delivery, so the child freezes at its current checkpoint — like a dead process.
 */
export function inMemorySpawn(deps: ChildHostDeps): SpawnChild & { spawned: number } {
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
			void runChildHost(io, deps).then(() => queueMicrotask(() => exit(0)));
			const channel: ChildChannel = {
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
			return channel;
		},
		{ spawned: 0 },
	);
	return spawn;
}
