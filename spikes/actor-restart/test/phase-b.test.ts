// Phase B: kill the host process mid-step, start a new host on the same storage; does the actor's
// workflow resume, and does the step re-execute?
import { type ChildProcess, execSync, fork } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "rivetkit/client";
import { afterAll, it as base, expect } from "vitest";

// RivetKit 2.3.27 has no working Windows runtime (see FINDINGS.md): run under Linux/WSL.
const it = base.skipIf(process.platform === "win32");

const dir = mkdtempSync(join(tmpdir(), "rg-actor-b-"));
const env = {
	...process.env,
	RIVETKIT_STORAGE_PATH: join(dir, "storage"),
	RG_EFFECTS_FILE: join(dir, "effects.log"),
	RG_CRASH_MARKER: join(dir, "crash-armed"),
	RG_LOG: "debug",
};
const hosts: ChildProcess[] = [];

let clientConfig: Record<string, unknown> = {};

function startHost(): Promise<ChildProcess> {
	const child = fork(new URL("./host.mjs", import.meta.url), {
		env,
		stdio: ["ignore", "inherit", "inherit", "ipc"],
	});
	hosts.push(child);
	return new Promise((resolve, reject) => {
		child.on("message", (m: { type: string; client?: Record<string, unknown> }) => {
			if (m.type !== "ready") return;
			clientConfig = m.client ?? {};
			resolve(child);
		});
		child.on("exit", (code) => reject(new Error(`host exited early (${code})`)));
	});
}

const waitFor = (child: ChildProcess, type: string) =>
	new Promise<void>((resolve) =>
		child.on("message", (m: { type: string }) => m.type === type && resolve()),
	);

afterAll(() => {
	for (const h of hosts) h.kill("SIGKILL");
	try {
		execSync("pkill -f 'rivet-engine start'");
	} catch {}
	rmSync(dir, { recursive: true, force: true });
});

it("resumes the workflow on a new host after a host kill", async () => {
	try {
		execSync("pkill -f 'rivet-engine start'"); // leftovers from earlier spike runs
	} catch {}
	writeFileSync(env.RG_CRASH_MARKER, "1");
	const t0 = Date.now();
	const host1 = await startHost();
	console.log("host1 ready", Date.now() - t0, "ms", clientConfig);

	const client = createClient<never>({ ...clientConfig, encoding: "bare" } as never) as never as {
		checkout: { getOrCreate(key: string[]): { status(): Promise<{ done: boolean }> } };
	};
	const handle = client.checkout.getOrCreate(["order-1"]);
	const inFlight = waitFor(host1, "in-flight");
	let fired = false;
	void inFlight.then(() => (fired = true));
	for (let i = 0; i < 60 && !fired; i++) {
		try {
			await handle.status();
		} catch (error) {
			if (i % 10 === 0) console.log("start error", Date.now() - t0, String(error).slice(0, 160));
			await new Promise((r) => setTimeout(r, 500));
		}
		if (!fired) await new Promise((r) => setTimeout(r, 100));
	}
	await inFlight;
	console.log("charge applied, killing host1", Date.now() - t0, "ms");
	host1.kill("SIGKILL");
	await new Promise((r) => host1.once("exit", r));
	const engineAlive = execSync("pgrep -f 'rivet-engine start' || true").toString().trim();
	console.log("engine still running after host kill:", engineAlive !== "");
	rmSync(env.RG_CRASH_MARKER);

	const t1 = Date.now();
	await startHost();
	console.log("host2 ready", Date.now() - t1, "ms");
	let status = { done: false };
	for (let i = 0; i < 600 && !status.done; i++) {
		try {
			status = await handle.status();
		} catch (error) {
			if (i % 20 === 0) console.log("status error", String(error).slice(0, 120));
		}
		if (!status.done) await new Promise((r) => setTimeout(r, 250));
	}
	console.log("resumed and finished", Date.now() - t1, "ms after host2 start");
	const charges = readFileSync(env.RG_EFFECTS_FILE, "utf8").trim().split("\n");
	console.log({ charges, fired: existsSync(env.RG_CRASH_MARKER + ".fired") });
	expect(status.done).toBe(true);
	expect(charges).toHaveLength(2); // step re-executed on the new host → duplicate charge
}, 90_000);
