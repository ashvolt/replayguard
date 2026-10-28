import type { ChildMessage } from "@replayguard/adapter-workflows";
import type { EffectContext } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { actorWorkflow } from "../src/actor-workflow.js";
import {
	type ActorHostDeps,
	type ActorLaunchParams,
	REPLAYGUARD_ACTOR,
	runActorHost,
} from "../src/host/actor-host.js";

const init = {
	type: "init",
	caseIndex: 1,
	workflowId: "wf",
	storageDir: "/tmp/rg",
	enginePort: 7420,
	scenarioModule: "file:///scenario.mjs",
	exportName: "scenarioFactory",
	input: { orderId: "o-1" },
};

/** A parent that answers every checkpoint with `continue`. */
function parent() {
	const sent: ChildMessage[] = [];
	let listener: (raw: unknown) => void = () => undefined;
	return {
		sent,
		io: {
			async send(m: ChildMessage) {
				sent.push(m);
				if ("token" in m) queueMicrotask(() => listener({ type: "continue", token: m.token }));
			},
			onMessage(l: (raw: unknown) => void) {
				listener = l;
				queueMicrotask(() => l(init));
			},
		},
	};
}

function module(workflow: (effects: { charge: () => Promise<string> }) => unknown) {
	return {
		scenarioFactory: () => ({
			definition: {
				effects: (ctx: EffectContext) => ({
					charge: ctx.instrument(async () => "charged", { kind: "payment", subject: () => "o-1" }),
				}),
				workflow,
			},
		}),
	};
}

function deps(
	mod: Record<string, unknown>,
	launch: (p: ActorLaunchParams) => Promise<void>,
): ActorHostDeps {
	return { importModule: async () => mod, launch };
}

describe("runActorHost", () => {
	it("launches the actor, relays effect checkpoints and reports completion", async () => {
		const p = parent();
		let params: ActorLaunchParams | undefined;
		const mod = module(({ charge }) =>
			actorWorkflow(async () => `paid:${await charge()}`, { state: { n: 1 } }),
		);
		await runActorHost(
			p.io,
			deps(mod, async (launch) => {
				params = launch;
				await launch.run({});
			}),
		);
		expect(params).toMatchObject({
			actorName: REPLAYGUARD_ACTOR,
			key: ["wf"],
			storageDir: "/tmp/rg",
			enginePort: 7420,
			input: { orderId: "o-1" },
			config: { state: { n: 1 } },
		});
		expect(p.sent.map((m) => m.type)).toEqual([
			"before-start",
			"in-flight",
			"after-settle",
			"run-ended",
		]);
		expect(p.sent.at(-1)).toEqual({
			type: "run-ended",
			outcome: { state: "completed", output: "paid:charged" },
		});
	});

	it("reports terminal step and workflow errors as failures and ignores retries", async () => {
		for (const [event, expected] of [
			[
				{ step: { willRetry: false, error: { name: "StepExhaustedError", message: "exhausted" } } },
				{ name: "StepExhaustedError", message: "exhausted" },
			],
			[
				{ workflow: { error: { name: "CriticalError", message: "boom", stack: "s" } } },
				{ name: "CriticalError", message: "boom" },
			],
		] as const) {
			const p = parent();
			await runActorHost(
				p.io,
				deps(
					module(() => actorWorkflow(async () => undefined)),
					async (launch) => {
						launch.onError({ step: { willRetry: true, error: { name: "E", message: "retry" } } });
						launch.onError({ rollback: { error: { name: "R", message: "rollback" } } });
						launch.onError(event);
					},
				),
			);
			expect(p.sent).toEqual([
				{ type: "run-ended", outcome: { state: "failed", error: expected } },
			]);
		}
	});

	it("reports only the first outcome", async () => {
		const p = parent();
		await runActorHost(
			p.io,
			deps(
				module(() => actorWorkflow(async () => "ok")),
				async (launch) => {
					await launch.run({});
					launch.onError({ workflow: { error: { name: "Late", message: "late" } } });
				},
			),
		);
		expect(p.sent).toEqual([{ type: "run-ended", outcome: { state: "completed", output: "ok" } }]);
	});

	it.each([
		[
			"a missing export",
			{ other: () => undefined },
			'scenario module does not export a function "scenarioFactory"',
		],
		[
			"a non-scenario",
			{ scenarioFactory: () => ({}) },
			'"scenarioFactory" must return a built scenario',
		],
		[
			"a plain workflow function",
			module(() => async () => undefined),
			"the scenario's workflow must return actorWorkflow(fn, config) for the RivetKit runtime",
		],
	])("reports %s as a harness error", async (_name, mod, message) => {
		const p = parent();
		await runActorHost(
			p.io,
			deps(mod, async () => undefined),
		);
		expect(p.sent).toHaveLength(1);
		expect(p.sent[0]).toMatchObject({ type: "harness-error" });
		expect((p.sent[0] as { message: string }).message).toContain(message);
	});

	it("reports invalid init messages and launch failures as harness errors", async () => {
		const bad = parent();
		bad.io.onMessage = (l) => queueMicrotask(() => l({ type: "init", caseIndex: -1 }));
		await runActorHost(
			bad.io,
			deps(
				module(() => actorWorkflow(async () => 1)),
				async () => undefined,
			),
		);
		expect(bad.sent[0]).toMatchObject({ type: "harness-error" });
		expect((bad.sent[0] as { message: string }).message).toContain("invalid init message");

		const p = parent();
		await runActorHost(
			p.io,
			deps(
				module(() => actorWorkflow(async () => 1)),
				async () => {
					throw new Error("engine failed to start");
				},
			),
		);
		expect((p.sent[0] as { message: string }).message).toContain("engine failed to start");

		const odd = parent();
		await runActorHost(
			odd.io,
			deps(
				module(() => actorWorkflow(async () => 1)),
				async () => {
					throw "not an error";
				},
			),
		);
		expect(odd.sent[0]).toEqual({ type: "harness-error", message: "not an error" });
	});
});
