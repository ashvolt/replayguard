/* v8 ignore start -- process glue around runActorHost (covered by the actor integration tests) */
import { runActorHost } from "./actor-host.js";
import { launchRivetKitActor } from "./launch.js";

void runActorHost(
	{
		send: (message) =>
			new Promise<void>((resolve, reject) => {
				if (!process.send) {
					reject(new Error("host-entry must be started with an IPC channel"));
					return;
				}
				process.send(message, (error: Error | null) => (error ? reject(error) : resolve()));
			}),
		onMessage: (listener) => {
			process.on("message", listener);
		},
	},
	{ importModule: (specifier) => import(specifier), launch: launchRivetKitActor },
).finally(() => {
	process.disconnect?.();
	// RivetKit keeps sockets and timers open; the run is over once the outcome is reported.
	process.exit(0);
});
/* v8 ignore stop */
