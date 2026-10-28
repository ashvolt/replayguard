import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { SPEC } from "./fixtures.ts";

describe("performance", () => {
	it("exports 13 features with 50 tasks each in under 5 s", async () => {
		const root = mkdtempSync(join(tmpdir(), "rg-export-perf-"));
		writeFileSync(join(root, "pnpm-workspace.yaml"), "");
		for (let f = 1; f <= 13; f++) {
			const dir = join(root, "specs", `${String(f).padStart(3, "0")}-feature`);
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "spec.md"), SPEC);
			const lines = ["## Phase 3: User Story 1 - A"];
			for (let t = 1; t <= 50; t++)
				lines.push(`- [ ] T${String(t).padStart(3, "0")} [P] [US1] Task ${t} in src/f${t}.ts`);
			writeFileSync(join(dir, "tasks.md"), lines.join("\n"));
		}
		const start = performance.now();
		expect(await run(["generate"], { cwd: root, env: {}, write: () => undefined })).toBe(0);
		expect(await run(["check"], { cwd: root, env: {}, write: () => undefined })).toBe(0);
		expect(performance.now() - start).toBeLessThan(5_000);
	});
});
