import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..", "..");
const license = readFileSync(join(root, "LICENSE"), "utf8");
const packages = readdirSync(join(root, "packages")).map((name) => {
	const dir = join(root, "packages", name);
	return { name, dir, json: JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) };
});

describe("publishable packages", () => {
	it.each(packages)("$name ships the root LICENSE", ({ dir }) => {
		expect(existsSync(join(dir, "LICENSE"))).toBe(true);
		expect(readFileSync(join(dir, "LICENSE"), "utf8")).toBe(license);
	});

	it.each(packages)(
		"$name declares license, files, provenance and repository directory",
		({ name, json }) => {
			expect(json.license).toBe("Apache-2.0");
			expect(json.private).toBeUndefined();
			expect(json.files).toEqual(expect.arrayContaining(["dist", "README.md"]));
			expect(json.publishConfig).toEqual({ access: "public", provenance: true });
			expect(json.repository.directory).toBe(`packages/${name}`);
			expect(json.engines.node).toBe(">=22");
		},
	);
});
