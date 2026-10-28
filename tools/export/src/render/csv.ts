const NEEDS_QUOTES = /[",\r\n]/;

const field = (value: string) =>
	NEEDS_QUOTES.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** RFC 4180 CSV: CRLF row separators, quoted fields when needed, trailing CRLF. */
export function toCsv(rows: readonly (readonly string[])[]): string {
	return rows.map((row) => `${row.map(field).join(",")}\r\n`).join("");
}

/** Minimal RFC 4180 reader (used by tests and freshness checks). */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i] as string;
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (c === '"') quoted = false;
			else cell += c;
		} else if (c === '"') quoted = true;
		else if (c === ",") {
			row.push(cell);
			cell = "";
		} else if (c === "\r" && text[i + 1] === "\n") {
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
			i++;
		} else cell += c;
	}
	return rows;
}
