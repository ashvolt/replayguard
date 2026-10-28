/**
 * Error thrown by the `throwAfter` (lost response) fault: the provider applied the effect, but the
 * response never reached the caller. Uses `code: "ECONNRESET"` like Node's network errors so
 * retry logic treats it as a transient network failure.
 *
 * @example
 * if (error instanceof SimulatedNetworkError) console.log(error.code); // "ECONNRESET"
 */
export class SimulatedNetworkError extends Error {
	/** Node-style network error code. */
	readonly code = "ECONNRESET";

	constructor(description: string) {
		super(
			`ECONNRESET: response lost after the provider applied the effect (simulated: ${description})`,
		);
		this.name = "SimulatedNetworkError";
	}
}
