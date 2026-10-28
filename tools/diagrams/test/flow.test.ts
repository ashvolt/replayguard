import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { layoutFlow } from "../src/layout/flow.ts";
import type { Box } from "../src/layout/types.ts";
import type { FlowDefinition } from "../src/schema.ts";

const flow = (over: Partial<FlowDefinition> = {}): FlowDefinition => ({
	kind: "hld",
	title: "Title",
	layout: "flow",
	direction: "LR",
	groups: [],
	nodes: [
		{ id: "a", label: "A", shape: "box", tasks: ["T001"] },
		{ id: "b", label: "B", shape: "ellipse", tasks: [] },
		{ id: "c", label: "C", shape: "database", tasks: ["T002", "T003"], note: "a note" },
	],
	edges: [
		{ from: "a", to: "b", style: "solid" },
		{ from: "b", to: "c", style: "dashed", label: "writes" },
	],
	...over,
});

type Rect = Pick<Box, "x" | "y" | "width" | "height">;

const overlaps = (p: Rect, q: Rect) =>
	p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;

describe("layoutFlow", () => {
	it("ranks nodes left-to-right along edges", () => {
		const out = layoutFlow(flow(), "004-x");
		const [a, b, c] = out.boxes;
		expect(a && b && c).toBeTruthy();
		expect(a?.x).toBeLessThan(b?.x ?? 0);
		expect(b?.x).toBeLessThan(c?.x ?? 0);
	});

	it("ranks top-to-bottom for TB", () => {
		const out = layoutFlow(flow({ direction: "TB" }), "004-x");
		const [a, b] = out.boxes;
		expect(a?.y).toBeLessThan(b?.y ?? 0);
	});

	it("renders labels, notes and task ids inside boxes", () => {
		const c = layoutFlow(flow(), "004-x").boxes[2];
		expect(c?.text.lines).toEqual(["C", "a note", "[T002, T003]"]);
		expect(c?.tasks).toEqual(["T002", "T003"]);
	});

	it("binds arrows to box keys and keeps labels and dash style", () => {
		const out = layoutFlow(flow(), "004-x");
		expect(out.arrows.map((a) => [a.from, a.to, a.dashed, a.label?.lines])).toEqual([
			["node:a", "node:b", false, undefined],
			["node:b", "node:c", true, ["writes"]],
		]);
		for (const arrow of out.arrows) expect(arrow.points.length).toBeGreaterThanOrEqual(2);
	});

	it("draws self loops as four-point paths", () => {
		const out = layoutFlow(flow({ edges: [{ from: "a", to: "a", style: "solid" }] }), "004-x");
		expect(out.arrows[0]?.points).toHaveLength(4);
	});

	it("terminates on cycles", () => {
		const out = layoutFlow(
			flow({
				edges: [
					{ from: "a", to: "b", style: "solid" },
					{ from: "b", to: "c", style: "solid" },
					{ from: "c", to: "a", style: "solid" },
				],
			}),
			"004-x",
		);
		expect(out.boxes).toHaveLength(3);
	});

	it("draws group frames around members", () => {
		const out = layoutFlow(
			flow({
				groups: [{ id: "core", label: "core pkg" }],
				nodes: flow().nodes.map((n) => (n.id === "c" ? n : { ...n, group: "core" })),
			}),
			"004-x",
		);
		const frame = out.frames[0];
		expect(frame?.label.lines).toEqual(["core pkg"]);
		for (const box of out.boxes.slice(0, 2)) {
			expect(box.x).toBeGreaterThan(frame?.x ?? Infinity);
			expect(box.x + box.width).toBeLessThan((frame?.x ?? 0) + (frame?.width ?? 0));
		}
	});

	it("skips frames for groups without members", () => {
		const out = layoutFlow(flow({ groups: [{ id: "empty", label: "empty" }] }), "004-x");
		expect(out.frames).toEqual([]);
	});

	it("keeps group frames disjoint and free of foreign nodes", () => {
		fc.assert(
			fc.property(
				fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 14 }),
				fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 20 }),
				fc.constantFrom<"LR" | "TB">("LR", "TB"),
				(groupPick, pairs, direction) => {
					const groups = ["g0", "g1", "g2"].map((id) => ({ id, label: id }));
					const ids = groupPick.map((_, i) => `n${i}`);
					const def = flow({
						direction,
						groups,
						nodes: ids.map((id, i) => {
							const g = groupPick[i] as number;
							return g < 3
								? { id, label: id, shape: "box" as const, tasks: [], group: `g${g}` }
								: { id, label: id, shape: "box" as const, tasks: [] };
						}),
						edges: pairs.map(([f, t]) => ({
							from: ids[f % ids.length] as string,
							to: ids[t % ids.length] as string,
							style: "solid" as const,
						})),
					});
					const out = layoutFlow(def, "f");
					for (let i = 0; i < out.frames.length; i++) {
						for (let j = i + 1; j < out.frames.length; j++) {
							expect(overlaps(out.frames[i] as Rect, out.frames[j] as Rect)).toBe(false);
						}
					}
					out.boxes.forEach((box, i) => {
						const own = def.nodes[i]?.group;
						for (const frame of out.frames) {
							if (frame.key === `group:${own}`) continue;
							expect(overlaps(box, frame)).toBe(false);
						}
					});
				},
			),
		);
	});

	it("is deterministic and never overlaps boxes", () => {
		const nodeIds = fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/), {
			minLength: 1,
			maxLength: 12,
		});
		fc.assert(
			fc.property(
				nodeIds,
				fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 20 }),
				fc.constantFrom<"LR" | "TB">("LR", "TB"),
				fc.array(fc.string({ maxLength: 60 }), { maxLength: 12 }),
				(ids, pairs, direction, labels) => {
					const def = flow({
						direction,
						nodes: ids.map((id, i) => ({
							id,
							label: labels[i] || id,
							shape: "box" as const,
							tasks: [],
						})),
						edges: pairs.map(([f, t]) => ({
							from: ids[f % ids.length] as string,
							to: ids[t % ids.length] as string,
							style: "solid" as const,
						})),
					});
					const one = layoutFlow(def, "f");
					expect(layoutFlow(def, "f")).toEqual(one);
					for (let i = 0; i < one.boxes.length; i++) {
						for (let j = i + 1; j < one.boxes.length; j++) {
							expect(overlaps(one.boxes[i] as Box, one.boxes[j] as Box)).toBe(false);
						}
					}
					for (const box of one.boxes) {
						expect(box.x + box.width).toBeLessThanOrEqual(one.width);
						expect(box.y + box.height).toBeLessThanOrEqual(one.height);
					}
				},
			),
		);
	});
});
