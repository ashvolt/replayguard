import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cruise, type IConfiguration } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

const config = createRequire(import.meta.url)("../.dependency-cruiser.cjs") as IConfiguration;

/** Writes a fixture repo where each file is `path → source` and returns violated rule names. */
async function violations(files: Record<string, string>): Promise<string[]> {
	// realpath: macOS tmpdir() is a symlink (/tmp → /private/tmp), which dependency-cruiser rejects.
	const root = realpathSync(mkdtempSync(join(tmpdir(), "rg-bounds-")));
	for (const [path, source] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), source);
	}
	const result = await cruise(["packages"], {
		...config.options,
		ruleSet: { forbidden: config.forbidden ?? [] },
		validate: true,
		baseDir: root,
	});
	const output = result.output as { summary: { violations: { rule: { name: string } }[] } };
	return [...new Set(output.summary.violations.map((v) => v.rule.name))].sort();
}

const ok = "export const x = 1;\n";

describe("package boundaries", () => {
	it("accepts allowed edges", async () => {
		expect(
			await violations({
				"packages/core/src/index.ts": `import "valibot";\nimport { y } from "./y.ts";\nexport const x = y;\n`,
				"packages/core/src/y.ts": "export const y = 1;\n",
				"packages/fakes/src/index.ts": `import "@replayguard/core";\n${ok}`,
				"packages/adapter-workflows/src/index.ts": `import "@replayguard/core";\nimport "@rivet-dev/workflows";\nimport "node:fs";\n${ok}`,
				"packages/adapter-rivetkit/src/index.ts": `import "@replayguard/adapter-workflows";\nimport "rivetkit";\n${ok}`,
				"packages/reporter-html/src/index.ts": `import "@replayguard/core";\n${ok}`,
				"packages/replayguard/src/index.ts": `import "@replayguard/core";\nimport "@replayguard/fakes";\nimport "@replayguard/vitest";\n${ok}`,
			}),
		).toEqual([]);
	});

	it("keeps core pure", async () => {
		expect(
			await violations({
				"packages/core/src/index.ts": `import "node:fs";\nimport "lodash";\nimport "@replayguard/fakes";\n${ok}`,
			}),
		).toEqual(["core-no-node-builtins", "core-no-other-packages", "core-only-valibot"]);
	});

	it("keeps Rivet inside adapters", async () => {
		expect(
			await violations({
				"packages/reporter-console/src/index.ts": `import "@rivet-dev/workflows";\n${ok}`,
			}),
		).toEqual(["no-rivet-outside-adapters"]);
	});

	it("enforces each package's allowed dependencies", async () => {
		expect(
			await violations({
				"packages/fakes/src/index.ts": `import "@replayguard/adapter-workflows";\n${ok}`,
				"packages/reporter-console/src/index.ts": `import "@replayguard/reporter-html";\n${ok}`,
				"packages/vitest/src/index.ts": `import "@replayguard/reporter-console";\n${ok}`,
				"packages/adapter-workflows/src/index.ts": `import "@replayguard/fakes";\n${ok}`,
				"packages/adapter-rivetkit/src/index.ts": `import "@replayguard/vitest";\n${ok}`,
				"packages/replayguard/src/index.ts": `import "@replayguard/reporter-html";\n${ok}`,
			}),
		).toEqual([
			"adapter-rivetkit-only-core-and-workflows",
			"adapter-workflows-only-core",
			"facade-only-core-fakes-vitest",
			"fakes-only-core",
			"reporters-only-core",
			"vitest-only-core",
		]);
	});

	it("forbids deep imports and cycles", async () => {
		expect(
			await violations({
				"packages/fakes/src/index.ts": `import { x } from "../../core/src/index.ts";\nexport const y = x;\n`,
				"packages/core/src/index.ts": ok,
				"packages/vitest/src/a.ts": `import { b } from "./b.ts";\nexport const a = b;\n`,
				"packages/vitest/src/b.ts": `import { a } from "./a.ts";\nexport const b = a;\n`,
			}),
		).toEqual(["no-circular", "no-deep-imports"]);
	});

	it("ignores tests and build output", async () => {
		expect(
			await violations({
				"packages/core/src/index.ts": ok,
				"packages/core/test/a.test.ts": `import "node:fs";\n${ok}`,
				"packages/core/dist/index.js": `import "node:fs";\n${ok}`,
			}),
		).toEqual([]);
	});
});
