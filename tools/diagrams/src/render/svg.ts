import type { Arrow, Box, LaidOutDiagram, Shape, TextBlock } from "../layout/types.ts";

const FILL: Record<Shape, string> = {
	box: "#e7f5ff",
	ellipse: "#fff3bf",
	diamond: "#ffe3e3",
	database: "#d3f9d8",
	package: "#f3f0ff",
};
const INK = "#1e1e1e";
const MUTED = "#868e96";
const FONT = "Helvetica, Arial, sans-serif";
const DASH = 'stroke-dasharray="8 6"';

const ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&apos;",
};

export function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (c) => ENTITIES[c] as string);
}

function textEl(block: TextBlock, anchor: "start" | "middle", x: number, fill = INK): string {
	const lineHeight = block.fontSize * 1.25;
	const tspans = block.lines
		.map(
			(line, i) =>
				`<tspan x="${x}" dy="${i === 0 ? block.fontSize : lineHeight}">${escapeXml(line)}</tspan>`,
		)
		.join("");
	return `<text x="${x}" y="${block.y}" font-family="${FONT}" font-size="${block.fontSize}" text-anchor="${anchor}" fill="${fill}">${tspans}</text>`;
}

function shape(box: Box): string {
	const fill = FILL[box.shape];
	const common = `fill="${fill}" stroke="${INK}" stroke-width="2"`;
	const { x, y, width: w, height: h } = box;
	switch (box.shape) {
		case "ellipse":
			return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${common}/>`;
		case "diamond":
			return `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" ${common}/>`;
		case "database":
			return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" ${common}/><path d="M${x},${y + 12} Q${x + w / 2},${y + 26} ${x + w},${y + 12}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
		case "package":
			return `<rect x="${x}" y="${y - 10}" width="${Math.min(60, w / 3)}" height="12" ${common}/><rect x="${x}" y="${y}" width="${w}" height="${h}" ${common}/>`;
		default:
			return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ${common}/>`;
	}
}

function arrow(a: Arrow): string {
	const points = a.points.map((p) => `${p.x},${p.y}`).join(" ");
	const parts = [
		`<polyline points="${points}" fill="none" stroke="${INK}" stroke-width="2" marker-end="url(#rg-arrow)"${a.dashed ? ` ${DASH}` : ""}/>`,
	];
	if (a.label) {
		const l = a.label;
		parts.push(
			`<rect x="${l.x - 3}" y="${l.y}" width="${l.width + 6}" height="${l.height + 4}" fill="#ffffff" opacity="0.85"/>`,
		);
		parts.push(textEl(l, "middle", l.x + l.width / 2));
	}
	return parts.join("");
}

/**
 * Renders laid-out geometry as a static, script-free SVG (white background, LF, trailing newline).
 *
 * @example
 * writeFileSync("hld.svg", renderSvg(layoutDiagram(def, feature)));
 */
export function renderSvg(d: LaidOutDiagram): string {
	const out: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="${d.height}" viewBox="0 0 ${d.width} ${d.height}" role="img">`,
		`<title>${escapeXml(d.title.lines.join(" "))}</title>`,
		`<defs><marker id="rg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker></defs>`,
		`<rect width="${d.width}" height="${d.height}" fill="#ffffff"/>`,
	];
	for (const f of d.frames) {
		out.push(
			`<rect x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" rx="10" fill="none" stroke="${MUTED}" stroke-width="1" ${DASH}/>`,
		);
		out.push(textEl(f.label, "start", f.label.x, MUTED));
	}
	for (const l of d.lines) {
		const points = l.points.map((p) => `${p.x},${p.y}`).join(" ");
		out.push(
			`<polyline points="${points}" fill="none" stroke="${MUTED}" stroke-width="1"${l.dashed ? ` ${DASH}` : ""}/>`,
		);
	}
	for (const b of d.boxes) {
		out.push(shape(b));
		out.push(textEl(b.text, "middle", b.x + b.width / 2));
	}
	for (const a of d.arrows) out.push(arrow(a));
	out.push(textEl(d.title, "start", d.title.x));
	out.push("</svg>");
	return `${out.join("\n")}\n`;
}
