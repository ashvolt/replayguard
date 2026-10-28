// Conformance case data shared by the TypeScript suite and the plain-JS scenario modules that
// child processes load. See conformance.ts for the CheckoutShape contract.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fault } from "@replayguard/core";

const PREFIX = "replayguard-conformance-";

/**
 * A payment provider's idempotency keys, kept in a file so they survive killed hosts (real
 * providers are external). `owner` is the test process pid (a host's `process.ppid`).
 */
export function externalKeyStore(owner, scope) {
	const file = join(tmpdir(), `${PREFIX}${owner}-${scope}.json`);
	const read = () => new Set(existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : []);
	return {
		has: (key) => read().has(key),
		add: (key) => writeFileSync(file, JSON.stringify([...read().add(key)])),
	};
}

/** Deletes the key stores owned by a test process. */
export function removeKeyStores(owner) {
	for (const name of readdirSync(tmpdir())) {
		if (name.startsWith(`${PREFIX}${owner}-`)) rmSync(join(tmpdir(), name), { force: true });
	}
}

/** Step timeout and provider hang (ms) for the timeout cases, generous enough for actors. */
export const TIMEOUT_MS = 300;
const HANG_MS = 1_200;

export const CONFORMANCE_CASES = [
	{
		name: "H0 lost response",
		shape: {},
		faults: [fault.loseResponse("payment")],
		expected: { payment: "duplicated", email: "exactly-once" },
	},
	{
		name: "H1 crash after charge",
		shape: {},
		faults: [fault.crashAfter("payment")],
		expected: { payment: "duplicated", email: "exactly-once" },
	},
	{
		name: "H1b crash after charge with key",
		shape: { key: true },
		faults: [fault.crashAfter("payment")],
		expected: { payment: "deduplicated", email: "exactly-once" },
	},
	{
		name: "H3a hang past a retried timeout",
		shape: { charge: { timeout: TIMEOUT_MS, retryOnTimeout: true, maxRetries: 1 } },
		faults: [fault.delay("payment", HANG_MS)],
		expected: { payment: "concurrent-duplicate", email: "exactly-once" },
	},
	{
		name: "H3b hang past a critical timeout",
		shape: { charge: { timeout: TIMEOUT_MS } },
		faults: [fault.delay("payment", HANG_MS)],
		expected: { payment: "orphaned" },
	},
	{
		name: "H4 ephemeral receipt lost by a later crash",
		shape: { ephemeralReceiptFirst: true },
		faults: [fault.crashAfter("payment")],
		expected: { email: "duplicated", payment: "duplicated" },
	},
];
