import type { EffectAttempt } from "./types.js";

/**
 * Number of attempts with this identity that the provider applied.
 *
 * @example
 * appliedCount(ledger.attempts(), "payment::order-1");
 */
export function appliedCount(
	attempts: readonly Readonly<EffectAttempt>[],
	identity: string,
): number {
	return attempts.filter((a) => a.identity === identity && a.status === "applied").length;
}

/**
 * Number of attempts with this identity that the provider deduplicated.
 *
 * @example
 * deduplicatedCount(ledger.attempts(), "payment::order-1");
 */
export function deduplicatedCount(
	attempts: readonly Readonly<EffectAttempt>[],
	identity: string,
): number {
	return attempts.filter((a) => a.identity === identity && a.status === "deduplicated").length;
}

/**
 * Pairs of attempts with this identity whose `[startedAt, settledAt)` intervals intersect with
 * positive length (unsettled attempts extend to infinity). Pairs are ordered by `seq`.
 *
 * @example
 * overlapping(ledger.attempts(), "payment::order-1"); // [[a1, a2]] after a timeout + retry
 */
export function overlapping(
	attempts: readonly Readonly<EffectAttempt>[],
	identity: string,
): [Readonly<EffectAttempt>, Readonly<EffectAttempt>][] {
	const list = attempts.filter((a) => a.identity === identity).sort((a, b) => a.seq - b.seq);
	const pairs: [Readonly<EffectAttempt>, Readonly<EffectAttempt>][] = [];
	for (let i = 0; i < list.length; i++) {
		for (let j = i + 1; j < list.length; j++) {
			const a = list[i] as Readonly<EffectAttempt>;
			const b = list[j] as Readonly<EffectAttempt>;
			const end = Math.min(
				a.settledAt ?? Number.POSITIVE_INFINITY,
				b.settledAt ?? Number.POSITIVE_INFINITY,
			);
			if (end - Math.max(a.startedAt, b.startedAt) > 0) pairs.push([a, b]);
		}
	}
	return pairs;
}
