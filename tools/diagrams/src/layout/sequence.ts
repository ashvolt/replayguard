import type { SequenceDefinition } from "../schema.ts";
import { measure, wrap } from "../text.ts";
import { finish, labelBlock, titleBlock } from "./flow.ts";
import {
	type Arrow,
	BODY_FONT,
	type Box,
	CONTENT_TOP,
	LABEL_FONT,
	type LaidOutDiagram,
	type Line,
	MARGIN,
} from "./types.ts";

const SLOT_MIN = 220;
const LOOP_W = 60;
const LOOP_H = 24;

/**
 * Sequence layout: actors as lifelines left-to-right, messages top-to-bottom in declared order.
 *
 * @example
 * const geometry = layoutSequence(workflowDefinition, "004-effect-ledger");
 */
export function layoutSequence(def: SequenceDefinition, feature: string): LaidOutDiagram {
	const actorSizes = def.actors.map((actor) => {
		const lines = wrap(actor.label, BODY_FONT, 180);
		const m = measure(lines, BODY_FONT);
		return { lines, m, width: Math.max(140, m.width + 40), height: Math.max(56, m.height + 24) };
	});
	const headerHeight = Math.max(...actorSizes.map((s) => s.height));
	const centers = new Map<string, number>();
	let cursorX = MARGIN;
	const boxes: Box[] = def.actors.map((actor, i) => {
		const s = actorSizes[i] as (typeof actorSizes)[number];
		const slot = Math.max(SLOT_MIN, s.width + 60);
		const cx = Math.round(cursorX + slot / 2);
		centers.set(actor.id, cx);
		cursorX += slot;
		const x = Math.round(cx - s.width / 2);
		return {
			key: `actor:${actor.id}`,
			x,
			y: CONTENT_TOP,
			width: s.width,
			height: s.height,
			shape: "box",
			label: actor.label,
			tasks: [],
			text: {
				lines: s.lines,
				fontSize: BODY_FONT,
				x: Math.round(x + (s.width - s.m.width) / 2),
				y: Math.round(CONTENT_TOP + (s.height - s.m.height) / 2),
				width: s.m.width,
				height: s.m.height,
			},
		};
	});

	let cursorY = CONTENT_TOP + headerHeight + 30;
	const arrows: Arrow[] = def.messages.map((message, i) => {
		const text =
			message.tasks.length > 0 ? `${message.label} [${message.tasks.join(", ")}]` : message.label;
		const lines = wrap(text, LABEL_FONT, 240);
		const labelHeight = measure(lines, LABEL_FONT).height;
		const from = centers.get(message.from) as number;
		const to = centers.get(message.to) as number;
		const y = Math.round(cursorY + labelHeight + 8);
		const arrow: Arrow = {
			key: `message:${i}`,
			points: [],
			dashed: message.style === "dashed",
			tasks: [...message.tasks],
		};
		if (from === to) {
			arrow.points = [
				{ x: from, y },
				{ x: from + LOOP_W, y },
				{ x: from + LOOP_W, y: y + LOOP_H },
				{ x: from, y: y + LOOP_H },
			];
			const size = measure(lines, LABEL_FONT);
			arrow.label = { lines, fontSize: LABEL_FONT, x: from + LOOP_W + 8, y: y - 4, ...size };
			cursorY = y + LOOP_H + 20;
		} else {
			arrow.points = [
				{ x: from, y },
				{ x: to, y },
			];
			arrow.label = labelBlock(text, { x: (from + to) / 2, y }, 240);
			cursorY = y + 20;
		}
		return arrow;
	});

	const bottom = cursorY + 30;
	const lines: Line[] = def.actors.map((actor, i) => {
		const cx = centers.get(actor.id) as number;
		return {
			key: `lifeline:${actor.id}`,
			points: [
				{ x: cx, y: CONTENT_TOP + (actorSizes[i] as (typeof actorSizes)[number]).height },
				{ x: cx, y: bottom },
			],
			dashed: true,
		};
	});

	return finish({
		feature,
		kind: def.kind,
		title: titleBlock(def.title),
		frames: [],
		boxes,
		arrows,
		lines,
	});
}
