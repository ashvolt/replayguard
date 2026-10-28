import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { measure, wrap } from "../src/text.ts";

describe("text", () => {
	it("keeps short labels on one line", () => {
		expect(wrap("Effect ledger", 16, 220)).toEqual(["Effect ledger"]);
	});

	it("wraps at word boundaries within max width", () => {
		const lines = wrap("one two three four five six seven eight nine ten eleven twelve", 16, 120);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) expect(line.length * 0.6 * 16).toBeLessThanOrEqual(120);
	});

	it("hard-splits words longer than a line", () => {
		const lines = wrap("x".repeat(40), 10, 60);
		expect(lines.join("")).toBe("x".repeat(40));
		for (const line of lines) expect(line.length).toBeLessThanOrEqual(10);
	});

	it("preserves explicit newlines and handles empty input", () => {
		expect(wrap("a\nb", 16, 220)).toEqual(["a", "b"]);
		expect(wrap("", 16, 220)).toEqual([""]);
	});

	it("measures width and height", () => {
		expect(measure(["abcd", "ab"], 10)).toEqual({ width: 24, height: 25 });
	});

	it("never loses non-space characters", () => {
		fc.assert(
			fc.property(fc.string({ maxLength: 200 }), (s) => {
				const clean = s.replace(/\s+/g, " ").trim();
				const out = wrap(clean, 16, 160).join(" ");
				expect(out.replace(/\s/g, "")).toBe(clean.replace(/\s/g, ""));
			}),
		);
	});
});
