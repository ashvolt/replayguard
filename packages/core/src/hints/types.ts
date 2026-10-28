/** A suggested fix attached to a non-passing effect classification. */
export interface FixHint {
	/** Stable hint ID, e.g. `add-idempotency-key`. */
	id: string;
	/** Short title (≤ 80 chars). */
	title: string;
	/** Why this fixes the outcome. */
	explanation: string;
	/** Code example using public APIs. */
	example: string;
}
