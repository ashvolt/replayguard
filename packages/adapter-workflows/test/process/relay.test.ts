import { EffectLedger, HarnessError } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import type { ChildMessage } from "../../src/process/protocol.js";
import { type ChildChannel, createCheckpointClient, relayRun } from "../../src/process/relay.js";

function childIo() {
	const sent: ChildMessage[] = [];
	let listener: (raw: unknown) => void = () => undefined;
	return {
		sent,
		reply: (raw: unknown) => listener(raw),
		io: {
			send: async (m: ChildMessage) => {
				sent.push(m);
			},
			onMessage: (l: (raw: unknown) => void) => {
				listener = l;
			},
		},
	};
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const call = { kind: "payment", subject: "o-1", identity: "payment::o-1", identityOccurrence: 1 };

describe("createCheckpointClient", () => {
	it("resolves init, answers checkpoints and rejects bad parent messages", async () => {
		const c = childIo();
		const client = createCheckpointClient(c.io);
		c.reply({ type: "init", anything: 1 });
		expect(await client.init).toEqual({ type: "init", anything: 1 });

		const bad = childIo();
		const badClient = createCheckpointClient(bad.io);
		bad.reply({ type: "eval" });
		await expect(badClient.init).rejects.toThrow(HarnessError);
	});

	it("is settled only when every started effect has settled", async () => {
		const c = childIo();
		const client = createCheckpointClient(c.io);
		expect(await Promise.race([client.settled().then(() => "idle"), tick()])).toBe("idle");

		const started = client.hooks.beforeStart?.(call as never);
		await tick();
		c.reply({ type: "continue", token: 1 });
		await started;
		let idle = false;
		void client.settled().then(() => (idle = true));
		await tick();
		expect(idle).toBe(false);

		const settled = client.hooks.afterSettle?.({ ...call, seq: 1, status: "applied" } as never);
		await tick();
		expect(c.sent.at(-1)).toMatchObject({ type: "after-settle", seq: 1, status: "applied" });
		c.reply({ type: "continue", token: 2 });
		await settled;
		await tick();
		expect(idle).toBe(true);
	});

	it("releases an effect whose start was rejected and rethrows the parent's error", async () => {
		const c = childIo();
		const client = createCheckpointClient(c.io);
		const started = client.hooks.beforeStart?.({ ...call, idempotencyKey: "k" } as never);
		await tick();
		expect(c.sent[0]).toEqual({
			type: "before-start",
			token: 1,
			kind: "payment",
			subject: "o-1",
			idempotencyKey: "k",
		});
		c.reply({
			type: "continue",
			token: 1,
			error: { name: "SimulatedNetworkError", message: "lost", code: "ECONNRESET" },
		});
		const error = await (started as Promise<void>).catch((e: unknown) => e);
		expect(error).toMatchObject({
			name: "SimulatedNetworkError",
			message: "lost",
			code: "ECONNRESET",
		});
		expect(await Promise.race([client.settled().then(() => "idle"), tick()])).toBe("idle");
	});

	it("reports a started attempt as failed when it settles without a status", async () => {
		const c = childIo();
		const client = createCheckpointClient(c.io);
		const settled = client.hooks.afterSettle?.({
			...call,
			seq: 3,
			status: "started",
			error: { name: "E", message: "m" },
		} as never);
		await tick();
		expect(c.sent[0]).toEqual({
			type: "after-settle",
			token: 1,
			seq: 3,
			status: "failed",
			error: { name: "E", message: "m" },
		});
		c.reply({ type: "continue", token: 1 });
		await settled;
	});
});

describe("relayRun", () => {
	function fakeChild() {
		let listener: (raw: unknown) => void = () => undefined;
		let exit: (code: number | null) => void = () => undefined;
		const sent: unknown[] = [];
		const child: ChildChannel = {
			send: (m) => sent.push(m),
			onMessage: (l) => {
				listener = l;
			},
			onExit: (l) => {
				exit = l;
			},
			kill: () => undefined,
		};
		return {
			child,
			sent,
			emit: (m: unknown) => listener(m),
			exit: (code: number | null) => exit(code),
		};
	}

	it("lets a run-ended message that is still being processed win over the exit", async () => {
		const f = fakeChild();
		const run = relayRun(f.child, new EffectLedger(), { crashed: false }, { type: "init" });
		f.emit({ type: "run-ended", outcome: { state: "completed" } });
		f.exit(0);
		expect(await run).toEqual({ state: "completed", output: undefined });
		expect(f.sent[0]).toEqual({ type: "init" });
	});

	it("rejects when the child exits without reporting", async () => {
		const f = fakeChild();
		const run = relayRun(f.child, new EffectLedger(), { crashed: false }, { type: "init" });
		f.exit(3);
		await expect(run).rejects.toThrow("child process exited (code 3) before reporting a result");
	});

	it("keeps mirroring late settles after the outcome resolved", async () => {
		const f = fakeChild();
		const ledger = new EffectLedger();
		const run = relayRun(f.child, ledger, { crashed: false }, { type: "init" });
		f.emit({ type: "before-start", token: 1, kind: "payment", subject: "o-1" });
		f.emit({ type: "in-flight", token: 2, call: 1, seq: 1 });
		f.emit({
			type: "run-ended",
			outcome: { state: "failed", error: { name: "StepFailedError", message: "timeout" } },
		});
		expect(await run).toMatchObject({ state: "failed" });
		f.emit({ type: "after-settle", token: 3, seq: 1, status: "applied" });
		await tick();
		await tick();
		expect(ledger.attempts().map((a) => a.status)).toEqual(["applied"]);
		expect(f.sent).toContainEqual({ type: "continue", token: 3 });
	});
});
