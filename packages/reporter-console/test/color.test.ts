import { describe, expect, it } from "vitest";
import { palette, shouldUseColor, useAscii } from "../src/color.js";

describe("color policy (T011)", () => {
	it("colors TTYs by default and never non-TTYs", () => {
		expect(shouldUseColor({}, true)).toBe(true);
		expect(shouldUseColor({}, false)).toBe(false);
		expect(shouldUseColor({}, undefined)).toBe(false);
	});

	it("honors NO_COLOR over everything", () => {
		expect(shouldUseColor({ NO_COLOR: "1" }, true)).toBe(false);
		expect(shouldUseColor({ NO_COLOR: "1", FORCE_COLOR: "1" }, true)).toBe(false);
		expect(shouldUseColor({ NO_COLOR: "" }, true)).toBe(true);
	});

	it("forces color with FORCE_COLOR unless it is 0 or false", () => {
		expect(shouldUseColor({ FORCE_COLOR: "1" }, false)).toBe(true);
		expect(shouldUseColor({ FORCE_COLOR: "" }, false)).toBe(true);
		expect(shouldUseColor({ FORCE_COLOR: "0" }, true)).toBe(false);
		expect(shouldUseColor({ FORCE_COLOR: "false" }, true)).toBe(false);
	});

	it("uses ASCII for dumb terminals", () => {
		expect(useAscii({ TERM: "dumb" })).toBe(true);
		expect(useAscii({ TERM: "xterm-256color" })).toBe(false);
		expect(useAscii({})).toBe(false);
	});

	it("wraps text in ANSI codes only when enabled", () => {
		const on = palette(true);
		expect(on.red("x")).toBe("\x1b[31mx\x1b[39m");
		expect(on.green("x")).toBe("\x1b[32mx\x1b[39m");
		expect(on.yellow("x")).toBe("\x1b[33mx\x1b[39m");
		expect(on.dim("x")).toBe("\x1b[2mx\x1b[22m");
		expect(on.bold("x")).toBe("\x1b[1mx\x1b[22m");
		const off = palette(false);
		for (const f of Object.values(off)) expect(f("x")).toBe("x");
	});
});
