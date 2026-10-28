/**
 * Error thrown by the `throwAfter` fault: the request or the response was lost on the network.
 * Uses `code: "ECONNRESET"` like Node's network errors so retry logic treats it as transient.
 *
 * @example
 * if (error instanceof SimulatedNetworkError) console.log(error.code); // "ECONNRESET"
 */
export class SimulatedNetworkError extends Error {
	/** Node-style network error code. */
	readonly code = "ECONNRESET";

	constructor(description: string) {
		super(`ECONNRESET: simulated network failure (${description})`);
		this.name = "SimulatedNetworkError";
	}
}
