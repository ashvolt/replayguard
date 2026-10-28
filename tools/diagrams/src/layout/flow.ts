import type { FlowDefinition, NodeDefinition } from "../schema.ts";
import { measure, wrap } from "../text.ts";
import {
	type Arrow,
	BODY_FONT,
	type Box,
	CONTENT_TOP,
	type Frame,
	LABEL_FONT,
	type LaidOutDiagram,
	MARGIN,
	type Point,
	type TextBlock,
	TITLE_FONT,
} from "./types.ts";

const TEXT_MAX = 220;
const MIN_W = 140;
const MIN_H = 60;
const RANK_GAP = 120;
const NODE_GAP = 50;
const FRAME_PAD = 24;
const FRAME_LABEL = 28;

export function nodeLines(node: NodeDefinition): string[] {
	const lines = wrap(node.label, BODY_FONT, TEXT_MAX);
	if (node.note !== undefined) lines.push(...wrap(node.note, BODY_FONT, TEXT_MAX));
	if (node.tasks.length > 0) lines.push(...wrap(`[${node.tasks.join(", ")}]`, BODY_FONT, TEXT_MAX));
	return lines;
}

export function titleBlock(title: string): TextBlock {
	const lines = [title];
	return { lines, fontSize: TITLE_FONT, x: MARGIN, y: 30, ...measure(lines, TITLE_FONT) };
}

export function labelBlock(text: string, center: Point, maxWidth: number): TextBlock {
	const lines = wrap(text, LABEL_FONT, maxWidth);
	const size = measure(lines, LABEL_FONT);
	return {
		lines,
		fontSize: LABEL_FONT,
		x: Math.round(center.x - size.width / 2),
		y: Math.round(center.y - size.height - 4),
		...size,
	};
}

/** Breaks cycles (DFS in declaration order) and returns DAG adjacency by node index. */
// Index helpers: callers only pass indices < n, so elements always exist.
const num = (a: readonly number[], i: number) => a[i] as number;
const list = (a: readonly number[][], i: number) => a[i] as number[];

function acyclic(n: number, edges: readonly [number, number][]): number[][] {
	const out: number[][] = Array.from({ length: n }, () => []);
	for (const [from, to] of edges) if (from !== to) list(out, from).push(to);
	const dag: number[][] = Array.from({ length: n }, () => []);
	const state = new Array<number>(n).fill(0);
	const visit = (u: number) => {
		state[u] = 1;
		for (const v of list(out, u)) {
			if (state[v] === 1) list(dag, v).push(u);
			else {
				list(dag, u).push(v);
				if (state[v] === 0) visit(v);
			}
		}
		state[u] = 2;
	};
	for (let u = 0; u < n; u++) if (state[u] === 0) visit(u);
	return dag;
}

/** Longest-path ranks over a DAG using Kahn's algorithm with declaration-order ties. */
function ranks(dag: number[][]): number[] {
	const n = dag.length;
	const indegree = new Array<number>(n).fill(0);
	for (const targets of dag) for (const v of targets) indegree[v] = num(indegree, v) + 1;
	const rank = new Array<number>(n).fill(0);
	const ready = indegree.flatMap((d, i) => (d === 0 ? [i] : []));
	while (ready.length > 0) {
		ready.sort((a, b) => a - b);
		const u = ready.shift() as number;
		for (const v of list(dag, u)) {
			rank[v] = Math.max(num(rank, v), num(rank, u) + 1);
			indegree[v] = num(indegree, v) - 1;
			if (indegree[v] === 0) ready.push(v);
		}
	}
	return rank;
}

function clip(box: Box, toward: Point): Point {
	const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	const dx = toward.x - c.x;
	const dy = toward.y - c.y;
	if (dx === 0 && dy === 0) return c;
	const s = Math.min(
		dx === 0 ? Infinity : box.width / 2 / Math.abs(dx),
		dy === 0 ? Infinity : box.height / 2 / Math.abs(dy),
	);
	return { x: Math.round(c.x + dx * s), y: Math.round(c.y + dy * s) };
}

/**
 * Layered (simplified Sugiyama) layout for flow diagrams.
 *
 * @example
 * const geometry = layoutFlow(definition, "004-effect-ledger");
 */
export function layoutFlow(def: FlowDefinition, feature: string): LaidOutDiagram {
	const index = new Map(def.nodes.map((node, i) => [node.id, i]));
	const at = (id: string) => index.get(id) as number;
	const dag = acyclic(
		def.nodes.length,
		def.edges.map((e) => [at(e.from), at(e.to)]),
	);
	const rank = ranks(dag);
	const preds: number[][] = def.nodes.map(() => []);
	dag.forEach((targets, u) => {
		for (const v of targets) list(preds, v).push(u);
	});

	// Schema validation guarantees every node group is declared.
	const groupIndex = new Map(def.groups.map((g, i) => [g.id, i]));
	const groupOf = (i: number) => {
		const g = (def.nodes[i] as NodeDefinition).group;
		return g === undefined ? def.groups.length : (groupIndex.get(g) as number);
	};

	const maxRank = Math.max(0, ...rank);
	const layers: number[][] = [];
	const position = new Array<number>(def.nodes.length).fill(0);
	for (let r = 0; r <= maxRank; r++) {
		const members = def.nodes.map((_, i) => i).filter((i) => rank[i] === r);
		const bary = (i: number) => {
			const p = list(preds, i);
			return p.length === 0
				? Number.MAX_SAFE_INTEGER
				: p.reduce((s, u) => s + num(position, u), 0) / p.length;
		};
		members.sort((a, b) => groupOf(a) - groupOf(b) || bary(a) - bary(b) || a - b);
		members.forEach((i, pos) => {
			position[i] = pos;
		});
		layers.push(members);
	}

	const sizes = def.nodes.map((node) => {
		const lines = nodeLines(node);
		const m = measure(lines, BODY_FONT);
		return {
			lines,
			m,
			width: Math.max(MIN_W, m.width + 40),
			height: Math.max(MIN_H, m.height + 30),
		};
	});
	const size = (i: number) => sizes[i] as (typeof sizes)[number];

	const lr = def.direction === "LR";
	const along = (i: number) => (lr ? size(i).width : size(i).height);
	const across = (i: number) => (lr ? size(i).height : size(i).width);
	const layerThickness = layers.map((l) => Math.max(0, ...l.map(along)));
	const spanOf = (members: readonly number[]) =>
		members.reduce((s, i) => s + across(i), 0) + NODE_GAP * Math.max(0, members.length - 1);

	// Swimlane bands: each group (then ungrouped nodes) owns a disjoint band on the cross axis,
	// so group frames never overlap each other or foreign nodes.
	const bandIds = [...new Set(def.nodes.map((_, i) => groupOf(i)))].sort((a, b) => a - b);
	const cell = (r: number, band: number) =>
		(layers[r] as number[]).filter((i) => groupOf(i) === band);
	const bandSpan = new Map(
		bandIds.map((band) => [band, Math.max(0, ...layers.map((_, r) => spanOf(cell(r, band))))]),
	);
	const originAlong = lr ? MARGIN + FRAME_PAD : CONTENT_TOP + FRAME_PAD + FRAME_LABEL;
	const originAcross = lr ? CONTENT_TOP + FRAME_PAD + FRAME_LABEL : MARGIN + FRAME_PAD;
	const bandStart = new Map<number, number>();
	let bandCursor = originAcross;
	for (const band of bandIds) {
		bandStart.set(band, bandCursor);
		bandCursor += (bandSpan.get(band) as number) + NODE_GAP + 2 * FRAME_PAD + FRAME_LABEL;
	}

	const boxes: Box[] = new Array(def.nodes.length);
	let cursorAlong = originAlong;
	layers.forEach((_, r) => {
		const thickness = num(layerThickness, r);
		for (const band of bandIds) {
			const members = cell(r, band);
			let cursorAcross =
				(bandStart.get(band) as number) + ((bandSpan.get(band) as number) - spanOf(members)) / 2;
			for (const i of members) {
				const node = def.nodes[i] as NodeDefinition;
				const { width, height, lines, m } = size(i);
				const a = cursorAlong + (thickness - along(i)) / 2;
				const x = Math.round(lr ? a : cursorAcross);
				const y = Math.round(lr ? cursorAcross : a);
				boxes[i] = {
					key: `node:${node.id}`,
					x,
					y,
					width,
					height,
					shape: node.shape,
					label: node.label,
					tasks: [...node.tasks],
					text: {
						lines,
						fontSize: BODY_FONT,
						x: Math.round(x + (width - m.width) / 2),
						y: Math.round(y + (height - m.height) / 2),
						width: m.width,
						height: m.height,
					},
				};
				cursorAcross += across(i) + NODE_GAP;
			}
		}
		cursorAlong += thickness + RANK_GAP;
	});

	const frames: Frame[] = [];
	for (const group of def.groups) {
		const members = boxes.filter((_, i) => (def.nodes[i] as NodeDefinition).group === group.id);
		if (members.length === 0) continue;
		const minX = Math.min(...members.map((b) => b.x));
		const minY = Math.min(...members.map((b) => b.y));
		const maxX = Math.max(...members.map((b) => b.x + b.width));
		const maxY = Math.max(...members.map((b) => b.y + b.height));
		const x = minX - FRAME_PAD;
		const y = minY - FRAME_PAD - FRAME_LABEL;
		const lines = wrap(group.label, LABEL_FONT, Math.max(80, maxX - minX));
		frames.push({
			key: `group:${group.id}`,
			x,
			y,
			width: maxX - minX + 2 * FRAME_PAD,
			height: maxY - minY + 2 * FRAME_PAD + FRAME_LABEL,
			label: { lines, fontSize: LABEL_FONT, x: x + 10, y: y + 6, ...measure(lines, LABEL_FONT) },
		});
	}

	const arrows: Arrow[] = def.edges.map((edge, e) => {
		const from = boxes[at(edge.from)] as Box;
		const to = boxes[at(edge.to)] as Box;
		let points: Point[];
		if (from === to) {
			const r = from.x + from.width;
			const cy = Math.round(from.y + from.height / 2);
			points = [
				{ x: r, y: cy - 12 },
				{ x: r + 40, y: cy - 12 },
				{ x: r + 40, y: cy + 12 },
				{ x: r, y: cy + 12 },
			];
		} else {
			const center = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
			points = [clip(from, center(to)), clip(to, center(from))];
		}
		const first = points[0] as Point;
		const last = points.at(-1) as Point;
		const arrow: Arrow = {
			key: `edge:${e}`,
			points,
			from: from.key,
			to: to.key,
			dashed: edge.style === "dashed",
			tasks: [],
		};
		if (edge.label !== undefined) {
			arrow.label = labelBlock(
				edge.label,
				{ x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 },
				160,
			);
		}
		return arrow;
	});

	return finish({
		feature,
		kind: def.kind,
		title: titleBlock(def.title),
		frames,
		boxes,
		arrows,
		lines: [],
	});
}

/** Computes canvas size from all content plus margin. */
export function finish(d: Omit<LaidOutDiagram, "width" | "height">): LaidOutDiagram {
	const rects: { x: number; y: number; width: number; height: number }[] = [
		d.title,
		...d.frames,
		...d.boxes,
	];
	for (const a of d.arrows) {
		for (const p of a.points) rects.push({ x: p.x, y: p.y, width: 0, height: 0 });
		if (a.label) rects.push(a.label);
	}
	for (const l of d.lines)
		for (const p of l.points) rects.push({ x: p.x, y: p.y, width: 0, height: 0 });
	return {
		...d,
		width: Math.ceil(Math.max(...rects.map((r) => r.x + r.width)) + MARGIN),
		height: Math.ceil(Math.max(...rects.map((r) => r.y + r.height)) + MARGIN),
	};
}
