import type { Evidence } from "../classifier/types.js";
import type { HintContext, HintRule } from "./types.js";

const NOTIFICATION = /^(email|webhook|sms|push|notification)([.:]|$)/;
const isCrash = (c: HintContext) =>
	c.faultEvents.filter((f) => f.strategy === "crash" || f.strategy === "processKill").length;

function rule(
	id: string,
	outcomes: HintRule["outcomes"],
	matches: HintRule["matches"],
	text: (e: Evidence, c: HintContext) => { title: string; explanation: string; example: string },
): HintRule {
	return { id, outcomes, matches, render: (e, c) => ({ id, ...text(e, c) }) };
}

const keyExample = (e: Evidence) => `await ctx.step("${e.kind}", () =>
  provider.call(request, { idempotencyKey: idempotencyKey(ctx, "${e.kind}") }));`;

/**
 * Built-in hint rules, checked in order; every match is attached.
 *
 * @example
 * HINT_RULES.map((r) => r.id); // ["add-idempotency-key", …]
 */
export const HINT_RULES: readonly HintRule[] = [
	rule(
		"add-idempotency-key",
		["duplicated"],
		(e) => e.keys.length === 0,
		(e) => ({
			title: "Send a stable idempotency key with the call",
			explanation: `${e.kind} was sent without an idempotency key, so the provider cannot tell a re-executed step from a new request. Derive the key from the workflow ID and step name so every retry sends the same key.`,
			example: keyExample(e),
		}),
	),
	rule(
		"provider-ignores-key",
		["duplicated"],
		(e) => e.keys.length === 1 && e.deduplicated === 0,
		(e) => ({
			title: "Check that the provider honors the idempotency key",
			explanation: `Every ${e.kind} attempt sent the same key "${e.keys[0]}", yet the provider applied it ${e.applied}×. Check that the provider (or your fake) deduplicates by that key and that it is sent in the right field or header.`,
			example: `createFakePayment(ctx, { idempotency: true });
// real providers: pass the key in the documented header, e.g. "Idempotency-Key"`,
		}),
	),
	rule(
		"unstable-idempotency-key",
		["duplicated", "concurrent-duplicate"],
		(e) => e.keys.length > 1,
		(e) => ({
			title: "Make the idempotency key stable across retries",
			explanation: `${e.kind} used ${e.keys.length} different keys (${e.keys.map((k) => JSON.stringify(k)).join(", ")}) for one logical effect, so the provider saw new requests. Remove time, randomness and attempt numbers from the key.`,
			example: `// ✗ \`\${orderId}:\${Date.now()}\`
const key = idempotencyKey(ctx, "${e.kind}"); // ✓ same on every retry`,
		}),
	),
	rule(
		"timeout-retry-concurrency",
		["concurrent-duplicate"],
		(_e, c) => c.faultEvents.some((f) => f.strategy === "delay"),
		(e) => ({
			title: "Do not retry a timed-out call without a key",
			explanation: `The step timed out while ${e.kind} was still running and the retry called the provider again, so the two calls overlapped. A step timeout does not cancel the call. Send a stable idempotency key, pass ctx.abortSignal to the provider, or avoid retryOnTimeout for this step.`,
			example: `await ctx.step({ name: "${e.kind}", timeout: 5_000, retryOnTimeout: true,
  run: () => provider.call(request, { signal: ctx.abortSignal, idempotencyKey: idempotencyKey(ctx, "${e.kind}") }) });`,
		}),
	),
	rule(
		"orphan-compensate",
		["orphaned"],
		(_e, c) => c.finalState === "failed",
		(e) => ({
			title: "Compensate or retry effects of a failed workflow",
			explanation: `${e.kind} was applied, but the workflow then failed and nothing records or undoes it. Add a compensation (rollback) step, or make the step retryable with an idempotency key so the workflow can finish.`,
			example: `try {
  await ctx.step("${e.kind}", () => provider.call(request));
} catch (error) {
  await ctx.step("undo-${e.kind}", () => provider.undo(request));
  throw error;
}`,
		}),
	),
	rule(
		"crash-loop-retries",
		["duplicated"],
		(e, c) => e.applied > 3 && isCrash(c) >= 2,
		(e) => ({
			title: "Crash loops bypass maxRetries: keys are mandatory",
			explanation: `${e.kind} was applied ${e.applied}× across repeated crashes. Retry counters reset when the process restarts, so maxRetries does not bound the number of calls. Only an idempotency key keeps this effect safe.`,
			example: keyExample(e),
		}),
	),
	rule(
		"skipped-ephemeral",
		["skipped"],
		() => true,
		(e) => ({
			title: "Do not swallow effect errors or lose ephemeral results",
			explanation: `${e.kind} never reached the provider, yet the workflow completed. Look for a catch that ignores the error, or an ephemeral step whose result was lost after a crash.`,
			example: `await ctx.step("${e.kind}", () => provider.call(request)); // let errors fail the step
// avoid: try { await provider.call(request); } catch {}`,
		}),
	),
	rule(
		"allow-by-policy",
		["duplicated", "concurrent-duplicate", "orphaned", "skipped"],
		(e) => NOTIFICATION.test(e.kind),
		(e, c) => ({
			title: "Accept this outcome for notifications via policy",
			explanation: `If a ${c.outcome} ${e.kind} is acceptable for your users (e.g. an occasional repeated notification), lower its verdict with a policy override instead of ignoring the report.`,
			example: `classify(result, { kinds: { "${e.kind}": { ${c.outcome === "concurrent-duplicate" ? '"concurrent-duplicate"' : c.outcome}: "warn" } } });`,
		}),
	),
];

/**
 * Fallback hint when no rule matches a non-passing outcome.
 *
 * @example
 * INVESTIGATE.render(evidence, context).id; // "investigate"
 */
export const INVESTIGATE: HintRule = rule(
	"investigate",
	["duplicated", "concurrent-duplicate", "orphaned", "skipped"],
	() => true,
	(e, c) => ({
		title: `Investigate the ${c.outcome} ${e.kind}`,
		explanation: `No built-in hint matches this case. Compare the attempts in the effect ledger with the baseline and check which step re-executed ${e.kind}.`,
		example: `const effect = classified.cases[i].effects.find((e) => e.kind === "${e.kind}");
console.log(effect.explanation, effect.evidence);`,
	}),
);
