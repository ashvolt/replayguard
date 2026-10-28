import { describe, expect, it } from "vitest";
import { createFakeEmail } from "../src/email.js";
import { statuses, testContext } from "./support/context.js";

describe("createFakeEmail (US2)", () => {
	it("records every send without dedup (AS1)", async () => {
		const { ctx, ledger } = testContext();
		const email = createFakeEmail(ctx);
		const msg = { to: "a@example.com", template: "receipt", data: { orderId: "o-1" } };
		expect(await email.send(msg)).toEqual({ id: "msg_000001" });
		expect(await email.send(msg)).toEqual({ id: "msg_000002" });
		expect(email.outbox).toEqual([
			{ id: "msg_000001", ...msg, sentAt: 1_000 },
			{ id: "msg_000002", ...msg, sentAt: 1_000 },
		]);
		expect(statuses(ledger)).toEqual(["applied", "applied"]);
		expect(ledger.attempts()[0]).toMatchObject({
			kind: "email.send",
			subject: "a@example.com|receipt",
		});
	});

	it("groups sends with a custom subject (AS2)", async () => {
		const { ctx, ledger } = testContext();
		const email = createFakeEmail(ctx, { subject: (m) => m.to + m.template });
		await email.send({ to: "a", template: "t", data: { at: 1 } });
		await email.send({ to: "a", template: "t", data: { at: 2 } });
		expect(new Set(ledger.attempts().map((a) => a.identity))).toEqual(new Set(["email.send::at"]));
	});

	it("omits data when not given and supports latency and failures", async () => {
		const { ctx, sleeper } = testContext();
		const email = createFakeEmail(ctx, { latencyMs: 5, failures: { times: 1 } });
		const failed = email.send({ to: "a", template: "t" }).catch((e: unknown) => e);
		await sleeper.advance(5);
		expect(await failed).toMatchObject({ status: 503 });
		const sent = email.send({ to: "a", template: "t" });
		await sleeper.advance(5);
		await sent;
		expect(email.outbox).toEqual([{ id: "msg_000001", to: "a", template: "t", sentAt: 1_010 }]);
		expect(Object.isFrozen(email.outbox)).toBe(true);
	});
});
