// Phase B host: a RivetKit registry with one workflow actor, run in a child process so the parent
// can SIGKILL it mid-step. External effects are appended to a file so they survive the kill.
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { actor, setup } from "rivetkit";
import { workflow } from "rivetkit/workflow";

const effects = process.env.RG_EFFECTS_FILE;
const armed = process.env.RG_CRASH_MARKER; // exists → first charge pauses after applying

const checkout = actor({
	state: { done: false },
	run: workflow(async (ctx) => {
		await ctx.step("charge", async () => {
			appendFileSync(effects, `charge pid=${process.pid}\n`);
			if (existsSync(armed)) {
				writeFileSync(armed + ".fired", "1");
				process.send?.({ type: "in-flight" });
				await new Promise(() => {}); // parent kills us here, before the step result is saved
			}
		});
		await ctx.step("finish", async (step) => {
			step.state.done = true;
		});
	}),
	actions: { status: (c) => ({ done: c.state.done }) },
});

const registry = setup({
	use: { checkout },
	startEngine: true,
	// The optional services sidecar is not needed for actors and fails to start here.
	startServices: false,
	noWelcome: true,
	logging: { level: process.env.RG_LOG ?? "warn" },
	shutdown: { disableSignalHandlers: true },
});
// Same as rivetkit/test setupTest(): test mode configures the default runner pool.
registry.config.test = { ...registry.config.test, enabled: true };
registry.start();
for (let i = 0; i < 200; i++) {
	try {
		if ((await registry.routes.health()).ok) break;
	} catch {}
	await new Promise((r) => setTimeout(r, 100));
}
const config = registry.parseConfig();
process.send?.({
	type: "ready",
	client: {
		endpoint: config.endpoint,
		token: config.token,
		namespace: config.namespace,
		poolName: config.envoy.poolName,
		headers: config.headers,
	},
});
