// ReplayGuard demo: does this checkout charge the customer twice when the host crashes?
// Run from the repo root: pnpm build && pnpm demo
import { workflowsRuntime } from "@replayguard/adapter-workflows";
import { renderConsole } from "@replayguard/reporter-console";
import { writeHtmlReport } from "@replayguard/reporter-html";
import {
	buildReport,
	createFakeEmail,
	createFakePayment,
	idempotencyKey,
	scenario,
} from "replayguard";

const color = process.env.FORCE_COLOR
	? process.env.FORCE_COLOR !== "0"
	: process.stdout.isTTY && !process.env.NO_COLOR;
const fast = { retryBackoffBase: 1, retryBackoffMax: 1 };

/** The workflow under test: charge the card, then email a receipt. */
function checkout({ withKey }) {
	return (
		scenario()
			.name(withKey ? "checkout (fixed)" : "checkout")
			.runtime(workflowsRuntime())
			.effects((ctx) => ({ payment: createFakePayment(ctx), email: createFakeEmail(ctx) }))
			.workflow(({ payment, email }) => async (wf) => {
				await wf.step({
					name: "charge",
					...fast,
					run: () =>
						payment.charge({
							orderId: "order-42",
							amount: 4_999,
							// The fix: a key that stays the same when the step re-executes.
							...(withKey ? { idempotencyKey: idempotencyKey(wf, "charge") } : {}),
						}),
				});
				await wf.step({
					name: "receipt",
					...fast,
					run: () => email.send({ to: "ada@example.com", template: "receipt" }),
				});
			})
			// Crash and lose responses before/after every effect, automatically.
			.explore()
			.build()
	);
}

async function act(title, withKey, policy, htmlPath) {
	console.log(`
━━━ ${title} ━━━`);
	const classified = await checkout({ withKey }).run({
		classify: true,
		...(policy ? { policy } : {}),
	});
	const report = buildReport(classified);
	console.log(renderConsole(report, { color }));
	const worst = report.cases.flatMap((c) => c.effects).find((e) => e.verdict === "fail");
	if (worst) {
		// Email cannot take an idempotency key, so prefer the policy hint when ReplayGuard offers it.
		const hint = worst.hints.find((h) => h.id === "allow-by-policy") ?? worst.hints[0];
		console.log(`Why:  ${worst.explanation}`);
		console.log(`Fix:  ${hint?.title}
${hint?.example.replace(/^/gm, "      ")}`);
	}
	await writeHtmlReport(report, htmlPath);
	console.log(`HTML timeline: ${htmlPath}`);
	return classified.verdict;
}

const verdicts = [
	await act("1. The checkout as written", false, undefined, "reports/demo-1.html"),
	await act(
		'2. One line later: idempotencyKey(wf, "charge")',
		true,
		undefined,
		"reports/demo-2.html",
	),
	await act(
		"3. Receipts can repeat (email has no idempotency): say so in policy",
		true,
		{ kinds: { "email.send": { duplicated: "warn" } } },
		"reports/demo-3.html",
	),
];
console.log(`
Verdicts: ${verdicts.map((v) => v.toUpperCase()).join(" → ")}`);
process.exitCode = verdicts[0] === "fail" && verdicts[2] !== "fail" ? 0 : 1;
