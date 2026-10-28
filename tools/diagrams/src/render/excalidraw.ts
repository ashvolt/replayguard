import { createIdFactory, type IdFactory } from "../ids.ts";
import type { Arrow, Box, LaidOutDiagram, Point, Shape, TextBlock } from "../layout/types.ts";

type Element = Record<string, unknown> & { id: string };
type BoundRef = { type: "text" | "arrow"; id: string };

const FILL: Record<Shape, string> = {
	box: "#e7f5ff",
	ellipse: "#fff3bf",
	diamond: "#ffe3e3",
	database: "#d3f9d8",
	package: "#f3f0ff",
};
const MUTED = "#868e96";

function base(
	ids: IdFactory,
	key: string,
	type: string,
	x: number,
	y: number,
	width: number,
	height: number,
): Element {
	return {
		id: ids.id(key),
		type,
		x,
		y,
		width,
		height,
		angle: 0,
		strokeColor: "#1e1e1e",
		backgroundColor: "transparent",
		fillStyle: "solid",
		strokeWidth: 2,
		strokeStyle: "solid",
		roughness: 1,
		opacity: 100,
		groupIds: [],
		frameId: null,
		roundness: null,
		seed: ids.seed(key),
		version: 1,
		versionNonce: ids.seed(`${key}:nonce`),
		isDeleted: false,
		boundElements: null,
		updated: 1,
		link: null,
		locked: false,
	};
}

function text(
	ids: IdFactory,
	key: string,
	block: TextBlock,
	containerId: string | null,
	align: "left" | "center",
): Element {
	const value = block.lines.join("\n");
	return {
		...base(ids, key, "text", block.x, block.y, block.width, block.height),
		strokeWidth: 1,
		text: value,
		originalText: value,
		fontSize: block.fontSize,
		fontFamily: 5,
		textAlign: align,
		verticalAlign: containerId ? "middle" : "top",
		containerId,
		autoResize: true,
		lineHeight: 1.25,
	};
}

function relative(points: readonly Point[]): {
	origin: Point;
	rel: number[][];
	width: number;
	height: number;
} {
	const origin = points[0] as Point;
	const rel = points.map((p) => [p.x - origin.x, p.y - origin.y]);
	const xs = rel.map((p) => p[0] as number);
	const ys = rel.map((p) => p[1] as number);
	return {
		origin,
		rel,
		width: Math.max(...xs) - Math.min(...xs),
		height: Math.max(...ys) - Math.min(...ys),
	};
}

function shapeElement(ids: IdFactory, box: Box): Element {
	const type =
		box.shape === "ellipse" ? "ellipse" : box.shape === "diamond" ? "diamond" : "rectangle";
	return {
		...base(ids, box.key, type, box.x, box.y, box.width, box.height),
		backgroundColor: FILL[box.shape],
		roundness: box.shape === "box" || box.shape === "database" ? { type: 3 } : null,
	};
}

function arrowElement(ids: IdFactory, arrow: Arrow): Element {
	const { origin, rel, width, height } = relative(arrow.points);
	const binding = (key: string | undefined) =>
		key === undefined ? null : { elementId: ids.id(key), focus: 0, gap: 6 };
	return {
		...base(ids, arrow.key, "arrow", origin.x, origin.y, width, height),
		strokeStyle: arrow.dashed ? "dashed" : "solid",
		points: rel,
		lastCommittedPoint: null,
		startBinding: binding(arrow.from),
		endBinding: binding(arrow.to),
		startArrowhead: null,
		endArrowhead: "arrow",
		elbowed: false,
	};
}

/**
 * Renders laid-out geometry as an Excalidraw v2 scene (JSON string, LF, trailing newline).
 *
 * @example
 * writeFileSync("hld.excalidraw", renderExcalidraw(layoutDiagram(def, feature)));
 */
export function renderExcalidraw(d: LaidOutDiagram): string {
	const ids = createIdFactory(`${d.feature}/${d.kind}`);
	const bound = new Map<string, BoundRef[]>();
	const bind = (containerId: string, ref: BoundRef) => {
		const list = bound.get(containerId) ?? [];
		list.push(ref);
		bound.set(containerId, list);
	};
	const elements: Element[] = [];

	for (const frame of d.frames) {
		elements.push({
			...base(ids, frame.key, "rectangle", frame.x, frame.y, frame.width, frame.height),
			strokeColor: MUTED,
			strokeWidth: 1,
			strokeStyle: "dashed",
			roundness: { type: 3 },
		});
		elements.push({
			...text(ids, `${frame.key}:label`, frame.label, null, "left"),
			strokeColor: MUTED,
		});
	}
	for (const line of d.lines) {
		const { origin, rel, width, height } = relative(line.points);
		elements.push({
			...base(ids, line.key, "line", origin.x, origin.y, width, height),
			strokeColor: MUTED,
			strokeWidth: 1,
			strokeStyle: line.dashed ? "dashed" : "solid",
			points: rel,
			lastCommittedPoint: null,
			startBinding: null,
			endBinding: null,
			startArrowhead: null,
			endArrowhead: null,
		});
	}
	for (const box of d.boxes) {
		const shape = shapeElement(ids, box);
		const label = text(ids, `${box.key}:text`, box.text, shape.id, "center");
		bind(shape.id, { type: "text", id: label.id });
		elements.push(shape, label);
	}
	for (const arrow of d.arrows) {
		const el = arrowElement(ids, arrow);
		if (arrow.from !== undefined) bind(ids.id(arrow.from), { type: "arrow", id: el.id });
		if (arrow.to !== undefined && arrow.to !== arrow.from)
			bind(ids.id(arrow.to), { type: "arrow", id: el.id });
		elements.push(el);
		if (arrow.label) {
			const label = text(ids, `${arrow.key}:label`, arrow.label, el.id, "center");
			bind(el.id, { type: "text", id: label.id });
			elements.push(label);
		}
	}
	elements.push(text(ids, "title", d.title, null, "left"));

	for (const el of elements) {
		const refs = bound.get(el.id);
		if (refs) el["boundElements"] = refs;
	}
	const scene = {
		type: "excalidraw",
		version: 2,
		source: "replayguard-diagrams",
		elements,
		appState: { viewBackgroundColor: "#ffffff", gridSize: 20 },
		files: {},
	};
	return `${JSON.stringify(scene, null, 2)}\n`;
}
