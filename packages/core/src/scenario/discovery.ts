import type { LedgerSnapshot } from "../ledger/types.js";

/** One effect occurrence observed in the baseline. */
export interface Occurrence {
	/** Effect kind. */
	kind: string;
	/** 1-based occurrence among attempts of the kind. */
	occurrence: number;
}

/**
 * Effect occurrences from a baseline ledger, in start order (any status).
 *
 * @example
 * discoverOccurrences(result.baseline.ledger, ["payment.charge"]);
 */
export function discoverOccurrences(
	snapshot: LedgerSnapshot,
	kinds?: readonly string[],
): Occurrence[] {
	return [...snapshot.attempts]
		.sort((a, b) => a.seq - b.seq)
		.filter((a) => kinds === undefined || kinds.includes(a.kind))
		.map((a) => ({ kind: a.kind, occurrence: a.kindOccurrence }));
}
