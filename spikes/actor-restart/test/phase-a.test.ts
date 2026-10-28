// Phase A: does an in-process registry with startEngine run a workflow actor to completion here?
import { mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { actor, setup } from "rivetkit";
import { setupTest } from "rivetkit/test";
import { workflow } from "rivetkit/workflow";
import { it as base, expect } from "vitest";

// RivetKit 2.3.27 has no working Windows runtime (see FINDINGS.md): run under Linux/WSL.
const it = base.skipIf(process.platform === "win32");

const charges: number[] = [];
// The win32 native addon package ships without its .node binary (2.3.27), and the wasm loader's
// default init uses fetch(file://), which Node does not support: hand it the bytes instead.
const require = createRequire(import.meta.url);
const wasmBytes = () =>
	readFileSync(require.resolve("@rivetkit/rivetkit-wasm/rivetkit_wasm_bg.wasm"));

const checkout = actor({
	state: { done: false },
	run: workflow(async (ctx) => {
		await ctx.step("charge", async () => {
			charges.push(Date.now());
		});
		// RivetKit: actor state is reachable only through the step context passed to run().
		await ctx.step("finish", async (step) => {
			step.state.done = true;
		});
	}),
	actions: {
		status: (c) => ({ done: c.state.done }),
	},
});

it("runs a workflow actor to completion", async (t) => {
	process.env["RIVETKIT_STORAGE_PATH"] = mkdtempSync(join(tmpdir(), "rg-actor-"));
	const started = Date.now();
	const registry = setup({
		use: { checkout },
		startEngine: true,
		// win32: the native addon package is empty (2.3.27); wasm cannot spawn the engine either.
		...(process.platform === "win32"
			? { runtime: "wasm", wasm: { initInput: { module_or_path: wasmBytes() } } }
			: {}),
		shutdown: { disableSignalHandlers: true },
	} as never);
	const { client } = await setupTest(t, registry);
	console.log("ready after", Date.now() - started, "ms");
	const typed = client as unknown as {
		checkout: { getOrCreate(key: string[]): { status(): Promise<{ done: boolean }> } };
	};
	const handle = typed.checkout.getOrCreate(["order-1"]);
	let status = await handle.status();
	for (let i = 0; i < 100 && !status.done; i++) {
		await new Promise((r) => setTimeout(r, 100));
		status = await handle.status();
	}
	console.log("done after", Date.now() - started, "ms", { charges: charges.length });
	expect(status.done).toBe(true);
	expect(charges).toHaveLength(1);
});
