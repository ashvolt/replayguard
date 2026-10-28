import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "../src/render/csv.ts";

describe("csv", () => {
	it("quotes fields with commas, quotes and newlines using CRLF rows", () => {
		expect(toCsv([["a", "b,c", 'say "hi"', "x\ny"]])).toBe('a,"b,c","say ""hi""","x\ny"\r\n');
	});

	it("round-trips arbitrary cells", () => {
		fc.assert(
			fc.property(
				fc.array(fc.array(fc.string(), { minLength: 1, maxLength: 6 }), {
					minLength: 1,
					maxLength: 8,
				}),
				(rows) => {
					expect(parseCsv(toCsv(rows))).toEqual(rows);
				},
			),
		);
	});
});
