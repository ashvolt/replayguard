/** Markup that is already escaped or trusted. */
export class SafeHtml {
	/** The markup. */
	readonly value: string;

	constructor(value: string) {
		this.value = value;
	}

	/**
	 * The markup, so `SafeHtml` can be used where a string is expected.
	 *
	 * @example
	 * String(html`<b>x</b>`); // "<b>x</b>"
	 */
	toString(): string {
		return this.value;
	}
}

const ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
	"`": "&#96;",
};

/**
 * Escapes text for HTML content and quoted attributes.
 *
 * @example
 * escapeHtml("<b>"); // "&lt;b&gt;"
 */
export function escapeHtml(text: string): string {
	return text.replace(/[&<>"'`]/g, (c) => ENTITIES[c] as string);
}

/**
 * Marks a trusted constant (never data) as markup.
 *
 * @example
 * html`<style>${raw(STYLES)}</style>`;
 */
export function raw(markup: string): SafeHtml {
	return new SafeHtml(markup);
}

function render(value: unknown): string {
	if (value instanceof SafeHtml) return value.value;
	if (Array.isArray(value)) return value.map(render).join("");
	if (value === null || value === undefined || value === false) return "";
	return escapeHtml(String(value));
}

/**
 * Tagged template that escapes every interpolated value unless it is `SafeHtml`; arrays are
 * joined and `null`, `undefined` and `false` render nothing.
 *
 * @example
 * html`<p>${userText}</p>`.value;
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
	let out = strings[0] as string;
	for (let i = 0; i < values.length; i++) out += render(values[i]) + (strings[i + 1] as string);
	return new SafeHtml(out);
}

const UNSAFE_IN_SCRIPT = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, "g");

/**
 * Escapes JSON for an inline `<script type="application/json">` block.
 *
 * @example
 * html`<script type="application/json">${raw(escapeJsonForScript(json))}</script>`;
 */
export function escapeJsonForScript(json: string): string {
	return json.replace(
		UNSAFE_IN_SCRIPT,
		(c) => `${"\\"}u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
	);
}
