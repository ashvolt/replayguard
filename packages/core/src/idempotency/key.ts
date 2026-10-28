import { ConfigError } from "../errors.js";
import { fnv1a64 } from "../ledger/canonical.js";

/** Optional key components. */
export interface IdempotencyKeyOptions {
	/** Loop iteration (integer ≥ 0). */
	iteration?: number;
	/** Prefix that separates key spaces, e.g. a provider name (1–64 chars). */
	namespace?: string;
	/** Extra stable components, e.g. a currency. */
	parts?: readonly (string | number)[];
}

const MAX_LENGTH = 255;
const PREFIX_LENGTH = 200;

const escapeComponent = (component: string) =>
	component.replace(/[%:#/]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function fail(message: string): never {
	throw new ConfigError(message, "RG_CONFIG_IDEMPOTENCY_KEY");
}

/**
 * Stable idempotency key for a step: `[namespace/]workflowId:step[#iteration][:part…]`.
 * It is built only from stable inputs (never attempt numbers, time or randomness), so a
 * re-executed step sends the same key. Components are escaped; keys longer than 255
 * characters become a 200-character prefix plus `:h<hash>`.
 *
 * @example
 * await ctx.step("charge", () =>
 *   payment.charge({ orderId, amount, idempotencyKey: idempotencyKey(ctx, "charge") }));
 */
export function idempotencyKey(
	ctx: { readonly workflowId: string },
	step: string,
	options: IdempotencyKeyOptions = {},
): string {
	if (typeof ctx?.workflowId !== "string" || ctx.workflowId === "") {
		fail("idempotencyKey needs a workflow context with a non-empty workflowId");
	}
	if (typeof step !== "string" || step === "") fail("step must be a non-empty string");
	const { iteration, namespace, parts = [] } = options;
	if (iteration !== undefined && !(Number.isInteger(iteration) && iteration >= 0)) {
		fail(`iteration must be an integer ≥ 0, got ${iteration}`);
	}
	if (namespace !== undefined && (namespace.length < 1 || namespace.length > 64)) {
		fail("namespace must be 1–64 characters");
	}
	const key = [
		namespace === undefined ? "" : `${escapeComponent(namespace)}/`,
		`${escapeComponent(ctx.workflowId)}:${escapeComponent(step)}`,
		iteration === undefined ? "" : `#${iteration}`,
		...parts.map((p) => `:${escapeComponent(String(p))}`),
	].join("");
	return key.length <= MAX_LENGTH ? key : `${key.slice(0, PREFIX_LENGTH)}:h${fnv1a64(key)}`;
}
