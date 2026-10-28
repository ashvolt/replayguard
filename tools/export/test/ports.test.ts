import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { defaultCommand } from "../src/import/github.ts";
import { dryRunTarget, runImport, TransientError } from "../src/import/importer.ts";
import { defaultHttp } from "../src/import/jira.ts";
import { ImportState } from "../src/import/state.ts";
import { demoItems } from "./fixtures.ts";

describe("default ports (offline)", () => {
	it("defaultCommand runs a process without a shell and surfaces failures", async () => {
		await expect(
			defaultCommand(process.execPath, ["-e", "process.stdout.write('ok $HOME')"]),
		).resolves.toEqual({
			stdout: "ok $HOME",
		});
		await expect(defaultCommand(process.execPath, ["-e", "process.exit(3)"])).rejects.toThrow();
	});

	it("defaultHttp talks to a local server", async () => {
		const server = createServer((req, res) => {
			let body = "";
			req.on("data", (c) => {
				body += c;
			});
			req.on("end", () => {
				res.writeHead(201, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ method: req.method, auth: req.headers.authorization, body }));
			});
		});
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
		const { port } = server.address() as { port: number };
		try {
			const res = await defaultHttp(`http://127.0.0.1:${port}/x`, {
				method: "POST",
				headers: { Authorization: "Basic abc" },
				body: "{}",
			});
			expect(res.status).toBe(201);
			expect(JSON.parse(await res.text())).toEqual({
				method: "POST",
				auth: "Basic abc",
				body: "{}",
			});
		} finally {
			server.close();
		}
	});
});

describe("edge paths", () => {
	it("dry-run target refuses to create", async () => {
		await expect(dryRunTarget("x").create(demoItems()[0] as never, null)).rejects.toThrow(
			"dry-run target",
		);
	});

	it("default sleep backs off with real timers", async () => {
		let calls = 0;
		const start = Date.now();
		await runImport(
			demoItems().slice(0, 1),
			{
				name: "t",
				create: async () => {
					if (calls++ === 0) throw new TransientError("503");
					return "K";
				},
			},
			{
				apply: true,
				includeDone: true,
				state: ImportState.load(join(mkdtempSync(join(tmpdir(), "rg-s-")), "s.json")),
				log: () => undefined,
			},
		);
		expect(Date.now() - start).toBeGreaterThanOrEqual(450);
	});

	it("state files without a created map load empty", () => {
		const path = join(mkdtempSync(join(tmpdir(), "rg-s-")), "s.json");
		writeFileSync(path, "{}");
		expect(ImportState.load(path).get("x")).toBeUndefined();
	});

	it("reports a missing repository root", async () => {
		const out: string[] = [];
		const code = await run(["generate"], {
			cwd: mkdtempSync(join(tmpdir(), "rg-noroot-")),
			env: {},
			write: (s) => out.push(s),
		});
		expect(code).toBe(1);
		expect(out.join("")).toContain("no pnpm-workspace.yaml found");
	});

	it("rethrows unexpected errors", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "rg-err-"));
		writeFileSync(join(cwd, "pnpm-workspace.yaml"), "");
		await expect(run(["generate"], { cwd, env: {}, write: () => undefined })).rejects.toThrow(
			/ENOENT/,
		);
	});
});
