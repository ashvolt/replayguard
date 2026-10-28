import { fault, scenario } from "@replayguard/core";
import type { WorkflowContextInterface } from "@rivet-dev/workflows";
import { describe, expect, it } from "vitest";
import { workflowsRuntime } from "../src/runtime.js";

export const checkout = () =>
	scenario()
		.name("checkout")
		.runtime(workflowsRuntime())
		.effects((ctx) => ({
			email: ctx.instrument(async (_to: string) => "sent", { kind: "email" }),
			charge: ctx.instrument(async (_order: string) => "charged", { kind: "payment" }),
		}))
		.workflow(({ email, charge }) => async (wf: WorkflowContextInterface) => {
			await wf.step({
				name: "charge",
				retryBackoffBase: 1,
				retryBackoffMax: 1,
				run: () => charge("o-1"),
			});
			await wf.step({
				name: "email",
				retryBackoffBase: 1,
				retryBackoffMax: 1,
				run: () => email("a@b.c"),
			});
			return "done";
		})
		.budget({ graceMs: 5 });

const applied = (attempts: readonly { kind: string; status: string }[], kind: string) =>
	attempts.filter((a) => a.kind === kind && a.status === "applied").length;

describe("scenario on the real engine (US1/US2)", () => {
	it("explicit crash case restarts and re-executes the charge", async () => {
		const result = await checkout()
			.case("crash after charge", [fault.crashAfter("payment")])
			.build()
			.run();
		expect(result.baseline.final).toEqual({ state: "completed", output: "done" });
		const [c] = result.cases;
		expect(c).toMatchObject({
			status: "settled",
			restarts: 1,
			final: { state: "completed", output: "done" },
		});
		expect(applied(c?.ledger.attempts ?? [], "payment")).toBe(2);
		expect(applied(c?.ledger.attempts ?? [], "email")).toBe(1);
	});

	it("explores 2 effects × 2 points × 2 strategies = 8 cases", async () => {
		const result = await checkout().explore().build().run();
		expect(result.cases.map((c) => c.name)).toEqual([
			"crash@after:payment#1",
			"crash@after:email#1",
			"throwAfter@after:payment#1",
			"throwAfter@after:email#1",
			"crash@before:payment#1",
			"crash@before:email#1",
			"throwAfter@before:payment#1",
			"throwAfter@before:email#1",
		]);
		expect(result.cases.every((c) => c.status === "settled")).toBe(true);
		const lostRequest = result.cases.find((c) => c.name === "throwAfter@before:payment#1");
		expect(applied(lostRequest?.ledger.attempts ?? [], "payment")).toBe(1);
		expect(result.skipped).toEqual([]);
	});
});
