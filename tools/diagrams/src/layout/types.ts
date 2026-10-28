import type { DiagramKind, NodeDefinition } from "../schema.ts";

export type Shape = NodeDefinition["shape"];

export interface Point {
	x: number;
	y: number;
}

/** Text with its top-left corner and measured size. */
export interface TextBlock {
	lines: string[];
	fontSize: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Box {
	/** Stable key used to derive element ids, e.g. `node:ledger`. */
	key: string;
	x: number;
	y: number;
	width: number;
	height: number;
	shape: Shape;
	label: string;
	tasks: string[];
	text: TextBlock;
}

export interface Arrow {
	key: string;
	points: Point[];
	/** Box keys the arrow is bound to (flow diagrams only). */
	from?: string;
	to?: string;
	dashed: boolean;
	tasks: string[];
	label?: TextBlock;
}

export interface Frame {
	key: string;
	x: number;
	y: number;
	width: number;
	height: number;
	label: TextBlock;
}

export interface Line {
	key: string;
	points: Point[];
	dashed: boolean;
}

/** Renderer-independent geometry: the single input to every renderer (Visitor targets). */
export interface LaidOutDiagram {
	feature: string;
	kind: DiagramKind;
	title: TextBlock;
	width: number;
	height: number;
	frames: Frame[];
	boxes: Box[];
	arrows: Arrow[];
	lines: Line[];
}

export const MARGIN = 40;
export const TITLE_FONT = 24;
export const BODY_FONT = 16;
export const LABEL_FONT = 14;
export const CONTENT_TOP = 90;
