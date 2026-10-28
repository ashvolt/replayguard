import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { escapeHtml, escapeJsonForScript, html, raw, SafeHtml } from "../src/html.js";

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

const CORPUS = [
	"<script>alert(1)</script>",
	"</script><script>alert(1)</script>",
	'"><img src=x onerror=alert(1)>',
	"' onmouseover='alert(1)",
	"javascript:alert(1)",
	"`$" + "{alert(1)}`",
	`a${LS}b${PS}c`,
	"&lt;already&gt;",
];

describe("html tagged template (T016)", () => {
	it("escapes every interpolated value", () => {
		for (const input of CORPUS) {
			const out = html`<p title="${input}">${input}</p>`.value;
			const escaped = escapeHtml(input);
			expect(out).toBe(`<p title="${escaped}">${escaped}</p>`);
			expect(escaped).not.toMatch(/[<>"'`]/);
		}
		expect(escapeHtml(`<>&"'\``)).toBe("&lt;&gt;&amp;&quot;&#39;&#96;");
	});

	it("keeps literal parts, nested SafeHtml and arrays", () => {
		const inner = html`<b>${"<x>"}</b>`;
		expect(inner).toBeInstanceOf(SafeHtml);
		expect(html`<i>${inner}</i>`.value).toBe("<i><b>&lt;x&gt;</b></i>");
		expect(html`<ul>${["<a>", html`<li>b</li>`]}</ul>`.value).toBe("<ul>&lt;a&gt;<li>b</li></ul>");
		expect(String(html`${1}-${0}`)).toBe("1-0");
	});

	it("renders nothing for null, undefined and false", () => {
		expect(html`[${null}${undefined}${false}]`.value).toBe("[]");
	});

	it("marks trusted constants as raw", () => {
		expect(html`${raw("<style></style>")}`.value).toBe("<style></style>");
	});

	it("never lets text produce a tag (property)", () => {
		fc.assert(
			fc.property(fc.string(), (s) => {
				expect(html`<p>${s}</p>`.value.slice(3, -4)).not.toMatch(/[<>"'`]/);
			}),
		);
	});
});

describe("escapeJsonForScript", () => {
	it("escapes characters that could end the script block or break JS", () => {
		const json = JSON.stringify({ s: `</script><!--&${LS}${PS}` });
		const out = escapeJsonForScript(json);
		expect(out).not.toMatch(new RegExp(`[<>&${LS}${PS}]`));
		expect(JSON.parse(out)).toEqual({ s: `</script><!--&${LS}${PS}` });
		expect(escapeJsonForScript("<>&")).toBe("\\u003c\\u003e\\u0026");
	});
});
