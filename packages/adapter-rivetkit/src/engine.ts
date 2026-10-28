import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

/** Ports a RivetKit engine started with `enginePort: P` binds, relative to P (spike phase C). */
export const ENGINE_PORT_OFFSETS: readonly number[] = [0, 1, 10];

const isFree = (port: number) =>
	new Promise<boolean>((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(false));
		server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
	});

/**
 * First base port in `[start, end]` whose engine ports (P, P+1, P+10) are all free.
 *
 * @example
 * const enginePort = await findEnginePort();
 */
export async function findEnginePort(
	range: { start: number; end: number } = { start: 7420, end: 7900 },
): Promise<number> {
	for (let port = range.start; port <= range.end; port++) {
		const free = await Promise.all(ENGINE_PORT_OFFSETS.map((o) => isFree(port + o)));
		if (free.every(Boolean)) return port;
	}
	throw new Error(`no free engine port block in ${range.start}–${range.end}`);
}

/**
 * PID of the engine recorded in `<storage>/.rivetkit/var/engine/runtime.json`, if any.
 *
 * @example
 * readEnginePid(storageDir); // 84865
 */
export function readEnginePid(storageDir: string): number | undefined {
	try {
		const runtime = JSON.parse(
			readFileSync(join(storageDir, ".rivetkit", "var", "engine", "runtime.json"), "utf8"),
		) as { pid?: unknown };
		return typeof runtime.pid === "number" ? runtime.pid : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Kills the engine recorded for a storage directory. The engine outlives its host process, so
 * the runtime kills it explicitly when a case is disposed. Returns whether a process was killed.
 *
 * @example
 * killEngine(storageDir);
 */
export function killEngine(
	storageDir: string,
	kill: (pid: number, signal: string) => unknown = (pid, signal) => process.kill(pid, signal),
): boolean {
	const pid = readEnginePid(storageDir);
	if (pid === undefined) return false;
	try {
		kill(pid, "SIGKILL");
		return true;
	} catch (error) {
		if ((error as { code?: unknown }).code === "ESRCH") return false;
		throw error;
	}
}
