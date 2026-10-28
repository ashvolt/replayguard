import type { FaultSpec, Outcome } from "@replayguard/core";

/**
 * The checkout workflow every runtime implements:
 * step "charge" → effect kind `payment` (subject `o-1`, idempotency key `<workflowId>:charge`
 * when `key`), then step "receipt" → effect kind `email` (subject `a@example.com`).
 * Steps use retryBackoffBase/Max = 1 unless stated.
 */
export interface CheckoutShape {
	/** Send a stable idempotency key; the payment provider dedups by key. */
	key?: boolean;
	/** Extra options for the "charge" step. */
	charge?: { timeout?: number; retryOnTimeout?: boolean; maxRetries?: number };
	/** Make the "receipt" step ephemeral and run it before "charge". */
	ephemeralReceiptFirst?: boolean;
}

/** One conformance case. */
export interface ConformanceCase {
	/** Case name (spike hypothesis). */
	name: string;
	/** Workflow shape. */
	shape: CheckoutShape;
	/** Faults of the single non-baseline case. */
	faults: FaultSpec[];
	/** Expected outcome per effect kind in that case. */
	expected: Record<string, Outcome>;
}

export declare const TIMEOUT_MS: number;
export declare const CONFORMANCE_CASES: readonly ConformanceCase[];

/** A provider idempotency-key store that survives killed hosts. */
export interface KeyStore {
	has(key: string): boolean;
	add(key: string): void;
}
export declare function externalKeyStore(owner: number | string, scope: string): KeyStore;
export declare function removeKeyStores(owner: number | string): void;
