export const CHAR_WIDTH_RATIO = 0.6;
export const LINE_HEIGHT = 1.25;

const widthOf = (chars: number, fontSize: number) => chars * CHAR_WIDTH_RATIO * fontSize;

/** Wraps text to lines no wider than `maxWidth` px (approximate metrics; Excalidraw re-measures). */
export function wrap(text: string, fontSize: number, maxWidth: number): string[] {
	const maxChars = Math.max(1, Math.floor(maxWidth / (CHAR_WIDTH_RATIO * fontSize)));
	const lines: string[] = [];
	for (const paragraph of text.split("\n")) {
		let line = "";
		for (const word of paragraph.split(" ").filter((w) => w.length > 0)) {
			let rest = word;
			while (rest.length > maxChars) {
				if (line) {
					lines.push(line);
					line = "";
				}
				lines.push(rest.slice(0, maxChars));
				rest = rest.slice(maxChars);
			}
			if (!line) line = rest;
			else if (line.length + 1 + rest.length <= maxChars) line = `${line} ${rest}`;
			else {
				lines.push(line);
				line = rest;
			}
		}
		lines.push(line);
	}
	return lines;
}

export function measure(
	lines: readonly string[],
	fontSize: number,
): { width: number; height: number } {
	const longest = Math.max(0, ...lines.map((l) => l.length));
	return {
		width: Math.ceil(widthOf(longest, fontSize)),
		height: Math.ceil(lines.length * fontSize * LINE_HEIGHT),
	};
}
