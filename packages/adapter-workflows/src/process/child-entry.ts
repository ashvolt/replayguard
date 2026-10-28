/* v8 ignore start -- process glue around runChildHost (covered by integration tests in a child) */
import { runChildHost } from "./child-host.js";

void runChildHost({
	send: (message) =>
		new Promise<void>((resolve, reject) => {
			if (!process.send) {
				reject(new Error("child-entry must be started with an IPC channel"));
				return;
			}
			process.send(message, (error: Error | null) => (error ? reject(error) : resolve()));
		}),
	onMessage: (listener) => {
		process.on("message", listener);
	},
}).finally(() => process.disconnect?.());
/* v8 ignore stop */
