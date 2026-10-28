import { describe, expect, it } from "vitest";
import { layoutSequence } from "../src/layout/sequence.ts";
import type { SequenceDefinition } from "../src/schema.ts";

const seq: SequenceDefinition = {
	kind: "workflow",
	title: "Recording",
	layout: "sequence",
	actors: [
		{ id: "step", label: "Workflow step" },
		{ id: "wrap", label: "instrumented fn" },
		{ id: "ledger", label: "EffectLedger" },
	],
	messages: [
		{ from: "step", to: "wrap", label: "charge(order)", tasks: ["T010"], style: "solid" },
		{ from: "wrap", to: "wrap", label: "self", tasks: [], style: "solid" },
		{ from: "ledger", to: "step", label: "result", tasks: [], style: "dashed" },
	],
};

describe("layoutSequence", () => {
	it("places actors left to right with lifelines", () => {
		const out = layoutSequence(seq, "004-x");
		const xs = out.boxes.map((b) => b.x);
		expect([...xs].sort((a, b) => a - b)).toEqual(xs);
		expect(out.lines).toHaveLength(3);
		for (const line of out.lines) expect(line.dashed).toBe(true);
	});

	it("orders messages top to bottom and appends task ids to labels", () => {
		const out = layoutSequence(seq, "004-x");
		const ys = out.arrows.map((a) => a.points[0]?.y ?? 0);
		expect(ys[0]).toBeLessThan(ys[1] ?? 0);
		expect(ys[1]).toBeLessThan(ys[2] ?? 0);
		expect(out.arrows[0]?.label?.lines.join(" ")).toBe("charge(order) [T010]");
		expect(out.arrows[0]?.tasks).toEqual(["T010"]);
	});

	it("draws self messages as loops and replies dashed", () => {
		const out = layoutSequence(seq, "004-x");
		expect(out.arrows[1]?.points).toHaveLength(4);
		expect(out.arrows[2]?.dashed).toBe(true);
		expect(out.arrows[2]?.points[0]?.x).toBeGreaterThan(out.arrows[2]?.points[1]?.x ?? 0);
	});

	it("keeps lifelines below actors down to the last message", () => {
		const out = layoutSequence(seq, "004-x");
		const lastY = out.arrows.at(-1)?.points.at(-1)?.y ?? 0;
		for (const line of out.lines) expect(line.points[1]?.y).toBeGreaterThan(lastY);
		expect(out.height).toBeGreaterThan(lastY);
	});
});
