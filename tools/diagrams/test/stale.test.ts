import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findStale } from "../src/stale.ts";

describe("findStale", () => {
	const outputs = new Map([
		["diagrams/hld.svg", "<svg/>\n"],
		["diagrams/hld.excalidraw", "{}\n"],
	]);

	it("is empty when files match", () => {
		const dir = mkdtempSync(join(tmpdir(), "rg-stale-"));
		mkdirSync(join(dir, "diagrams"));
		writeFileSync(join(dir, "diagrams", "hld.svg"), "<svg/>\n");
		writeFileSync(join(dir, "diagrams", "hld.excalidraw"), "{}\n");
		expect(findStale(dir, outputs)).toEqual([]);
	});

	it("lists missing, changed and orphaned files", () => {
		const dir = mkdtempSync(join(tmpdir(), "rg-stale-"));
		mkdirSync(join(dir, "diagrams"));
		writeFileSync(join(dir, "diagrams", "hld.svg"), "<svg changed/>\n");
		writeFileSync(join(dir, "diagrams", "old.svg"), "x");
		expect(findStale(dir, outputs)).toEqual([
			"diagrams/hld.excalidraw",
			"diagrams/hld.svg",
			"diagrams/old.svg",
		]);
	});

	it("treats CRLF checkouts as fresh", () => {
		const dir = mkdtempSync(join(tmpdir(), "rg-stale-"));
		mkdirSync(join(dir, "diagrams"));
		writeFileSync(join(dir, "diagrams", "hld.svg"), "<svg/>\r\n");
		writeFileSync(join(dir, "diagrams", "hld.excalidraw"), "{}\r\n");
		expect(findStale(dir, outputs)).toEqual([]);
	});

	it("reports everything when the output folder is missing", () => {
		const dir = mkdtempSync(join(tmpdir(), "rg-stale-"));
		expect(findStale(dir, outputs)).toEqual(["diagrams/hld.excalidraw", "diagrams/hld.svg"]);
	});
});
