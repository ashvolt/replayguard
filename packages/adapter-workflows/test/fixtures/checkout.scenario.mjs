// Scenario module loaded by real child processes (process-kill integration test).
import { workflowsProcessRuntime } from "@replayguard/adapter-workflows";
import { fault, scenario } from "@replayguard/core";

const base = () =>
	scenario()
		.name("checkout-process")
		.runtime(workflowsProcessRuntime({ scenarioModule: import.meta.url }))
		.effects((ctx) => ({ charge: ctx.instrument(async () => "ok", { kind: "payment" }) }))
		.workflow(
			({ charge }) =>
				async (wf) =>
					wf.step({ name: "charge", retryBackoffBase: 1, retryBackoffMax: 1, run: () => charge() }),
		)
		.budget({ graceMs: 5 });

export const scenarioFactory = () =>
	base()
		.case("kill after charge", [fault.killAfter("payment")])
		.case("kill never triggers", [fault.killAfter("payment", 2)])
		.build();

export const hangingFactory = () =>
	scenario()
		.name("hang")
		.runtime(
			workflowsProcessRuntime({ scenarioModule: import.meta.url, exportName: "hangingFactory" }),
		)
		.effects(() => ({}))
		.workflow(
			() => async (wf) =>
				wf.step({ name: "forever", timeout: 0, run: () => new Promise(() => {}) }),
		)
		.budget({ caseTimeoutMs: 1500, graceMs: 0 })
		.build();
