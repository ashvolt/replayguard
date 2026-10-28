/** Table layout options. */
export interface TableOptions {
	/** Use `|`, `-`, `+` instead of box-drawing characters. */
	ascii?: boolean;
	/** Maximum column width (default 40). */
	maxWidth?: number;
	/** Decorates a cell's visible text (row -1 = header); padding is added afterwards. */
	style?: (text: string, row: number, col: number) => string;
}

/**
 * Cuts text to `width` characters, ending with `…` when cut.
 *
 * @example
 * truncate("abcd", 3); // "ab…"
 */
export function truncate(text: string, width: number): string {
	return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
}

/**
 * Renders a plain-text table with columns sized to their content (capped at `maxWidth`).
 *
 * @example
 * renderTable(["Case", "Verdict"], [["crash", "FAIL"]]);
 */
export function renderTable(
	headers: readonly string[],
	rows: readonly (readonly string[])[],
	options: TableOptions = {},
): string {
	const max = options.maxWidth ?? 40;
	const [bar, line, cross] = options.ascii ? ["|", "-", "+"] : ["│", "─", "┼"];
	const cells = [headers, ...rows].map((r) =>
		r.map((cell) => truncate(cell.replace(/\s*\n\s*/g, " "), max)),
	);
	const widths = headers.map((_, col) => Math.max(...cells.map((r) => (r[col] ?? "").length)));
	const format = (r: readonly string[], row: number) =>
		r
			.map((text, col) => {
				const styled = options.style ? options.style(text, row, col) : text;
				const pad = col === r.length - 1 ? "" : " ".repeat((widths[col] as number) - text.length);
				return styled + pad;
			})
			.join(` ${bar} `);
	return [
		format(cells[0] as string[], -1),
		widths
			.map((w, col) => line.repeat(w + (col > 0 ? 1 : 0) + (col < widths.length - 1 ? 1 : 0)))
			.join(cross),
		...cells.slice(1).map((r, i) => format(r, i)),
	].join("\n");
}
