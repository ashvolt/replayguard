// Phase C: where does the engine record its PID, and does enginePort move both engine ports?
import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { actor, setup } from "rivetkit";
import { workflow } from "rivetkit/workflow";
import { afterAll, it as base } from "vitest";

// RivetKit 2.3.27 has no working Windows runtime (see FINDINGS.md): run under Linux/WSL.
const it = base.skipIf(process.platform === "win32");

const storage = mkdtempSync(join(tmpdir(), "rg-actor-c-"));

function walk(dir: string, depth = 0): string[] {
	if (depth > 6) return [];
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path, depth + 1) : [path];
	});
}

afterAll(() => {
	try {
		execSync("pkill -f 'rivet-engine start'");
	} catch {}
	rmSync(storage, { recursive: true, force: true });
});

it("records the engine pid and ports", async () => {
	try {
		execSync("pkill -f 'rivet-engine start'");
	} catch {}
	process.env["RIVETKIT_STORAGE_PATH"] = storage;
	const a = actor({ state: {}, run: workflow(async () => undefined), actions: {} });
	const registry = setup({
		use: { a },
		startEngine: true,
		enginePort: 7420,
		startServices: false,
		noWelcome: true,
		shutdown: { disableSignalHandlers: true },
	} as never);
	registry.config.test = { ...registry.config.test, enabled: true };
	registry.start();
	for (let i = 0; i < 200; i++) {
		try {
			if ((await registry.routes.health()).ok) break;
		} catch {}
		await new Promise((r) => setTimeout(r, 100));
	}
	console.log(
		"files:",
		walk(storage)
			.map((p) => p.slice(storage.length))
			.filter((p) => !p.includes("/db/"))
			.slice(0, 40),
	);
	for (const p of walk(storage).filter((p) => p.endsWith(".json"))) {
		console.log(p.slice(storage.length), readFileSync(p, "utf8").slice(0, 400));
	}
	console.log(execSync("pgrep -af 'rivet-engine start' || true").toString());
	console.log(execSync("ss -ltnp 2>/dev/null | grep rivet-engine || true").toString());
}, 120_000);
