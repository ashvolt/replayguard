// Consumer smoke test (ESM): runs against packed tarballs, see scripts/pack-smoke.sh.

import { actorWorkflow } from "@replayguard/adapter-rivetkit";
import { workflowsRuntime } from "@replayguard/adapter-workflows";
import { renderConsole } from "@replayguard/reporter-console";
import { renderHtml } from "@replayguard/reporter-html";
import * as rg from "replayguard";

for (const n of [
	"scenario",
	"fault",
	"classify",
	"buildReport",
	"idempotencyKey",
	"createFakePayment",
	"replayGuardMatchers",
])
	if (!(n in rg)) throw new Error(`missing ${n}`);
const result = await rg
	.scenario()
	.runtime(workflowsRuntime())
	.effects((ctx) => ({ payment: rg.createFakePayment(ctx) }))
	.workflow(
		({ payment }) =>
			async (wf) =>
				wf.step("charge", () => payment.charge({ orderId: "o-1", amount: 500 })),
	)
	.case("crash after charge", [rg.fault.crashAfter("payment.charge")])
	.build()
	.run({ classify: true });
const report = rg.buildReport(result);
const text = renderConsole(report);
const html = await renderHtml(report);
const checks = {
	verdict: result.verdict === "fail",
	duplicated: result.cases[1].effects[0].outcome === "duplicated",
	console: text.includes("duplicated"),
	html: html.startsWith("<!doctype html>"),
	rivetkit: typeof actorWorkflow === "function",
};
if (!Object.values(checks).every(Boolean))
	throw new Error(`ESM smoke failed: ${JSON.stringify(checks)}`);
console.log("esm ok");
