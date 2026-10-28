import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENGINE_PORT_OFFSETS, findEnginePort, killEngine, readEnginePid } from "../src/engine.js";

const dirs: string[] = [];
const storage = () => {
	const dir = mkdtempSync(join(tmpdir(), "rg-engine-"));
	dirs.push(dir);
	return dir;
};
const writeRuntime = (dir: string, body: string) => {
	mkdirSync(join(dir, ".rivetkit", "var", "engine"), { recursive: true });
	writeFileSync(join(dir, ".rivetkit", "var", "engine", "runtime.json"), body);
};

afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("engine helpers", () => {
	it("knows which ports an engine binds relative to its base port", () => {
		expect(ENGINE_PORT_OFFSETS).toEqual([0, 1, 10]);
	});

	it("finds a base port whose engine ports are all free", async () => {
		const blocker = createServer();
		await new Promise<void>((r) => blocker.listen(0, "127.0.0.1", r));
		const busy = (blocker.address() as { port: number }).port;
		try {
			const port = await findEnginePort({ start: busy - 1, end: busy + 40 });
			for (const offset of ENGINE_PORT_OFFSETS) expect(port + offset).not.toBe(busy);
			expect(port).toBeGreaterThanOrEqual(busy - 1);
		} finally {
			blocker.close();
		}
	});

	it("fails when no port block is free", async () => {
		const blocker = createServer();
		await new Promise<void>((r) => blocker.listen(0, "127.0.0.1", r));
		const busy = (blocker.address() as { port: number }).port;
		try {
			await expect(findEnginePort({ start: busy, end: busy })).rejects.toThrow(
				`no free engine port block in ${busy}–${busy}`,
			);
		} finally {
			blocker.close();
		}
	});

	it("reads the engine pid from runtime.json", () => {
		const dir = storage();
		expect(readEnginePid(dir)).toBeUndefined();
		writeRuntime(dir, JSON.stringify({ pid: 4242, endpoint: "http://127.0.0.1:7420" }));
		expect(readEnginePid(dir)).toBe(4242);
		writeRuntime(dir, "{not json");
		expect(readEnginePid(dir)).toBeUndefined();
		writeRuntime(dir, JSON.stringify({ pid: "x" }));
		expect(readEnginePid(dir)).toBeUndefined();
	});

	it("kills the recorded engine and tolerates one that is already gone", () => {
		const dir = storage();
		const killed: [number, string][] = [];
		const kill = (pid: number, signal: string) => {
			killed.push([pid, signal]);
			if (pid === 2) throw Object.assign(new Error("gone"), { code: "ESRCH" });
			return true;
		};
		expect(killEngine(dir, kill)).toBe(false);
		writeRuntime(dir, JSON.stringify({ pid: 1 }));
		expect(killEngine(dir, kill)).toBe(true);
		writeRuntime(dir, JSON.stringify({ pid: 2 }));
		expect(killEngine(dir, kill)).toBe(false);
		expect(killed).toEqual([
			[1, "SIGKILL"],
			[2, "SIGKILL"],
		]);
		writeRuntime(dir, JSON.stringify({ pid: 3 }));
		// Default killer: a PID that does not exist is treated as already gone.
		writeRuntime(dir, JSON.stringify({ pid: 2 ** 22 + 7 }));
		expect(killEngine(dir)).toBe(false);
		writeRuntime(dir, JSON.stringify({ pid: 3 }));
		expect(() =>
			killEngine(dir, () => {
				throw Object.assign(new Error("denied"), { code: "EPERM" });
			}),
		).toThrow("denied");
	});
});
