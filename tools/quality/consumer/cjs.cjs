// Consumer smoke test (CommonJS): runs against packed tarballs, see scripts/pack-smoke.sh.
const rg = require("replayguard");
const { workflowsRuntime } = require("@replayguard/adapter-workflows");
const { renderConsole } = require("@replayguard/reporter-console");
const { renderHtml } = require("@replayguard/reporter-html");
const ok =
	[rg.scenario, rg.classify, workflowsRuntime, renderConsole, renderHtml].every(
		(f) => typeof f === "function",
	) && rg.idempotencyKey({ workflowId: "wf" }, "charge") === "wf:charge";
if (!ok) throw new Error("CJS smoke failed");
console.log("cjs ok");
