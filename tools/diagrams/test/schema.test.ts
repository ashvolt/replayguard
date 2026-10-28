import { describe, expect, it } from "vitest";
import { DiagramValidationError, validateSource } from "../src/schema.ts";

type Raw = Record<string, unknown>;
type RawSource = {
	feature: string;
	diagrams: (Raw & { nodes?: Raw[]; edges?: Raw[]; messages?: Raw[] })[];
};

const valid: RawSource = {
	feature: "004-effect-ledger",
	diagrams: [
		{
			kind: "hld",
			title: "Ledger",
			layout: "flow",
			groups: [{ id: "core", label: "core" }],
			nodes: [
				{ id: "a", label: "A", group: "core", tasks: ["T001"] },
				{ id: "b", label: "B", shape: "database" },
			],
			edges: [{ from: "a", to: "b", label: "writes" }],
		},
		{
			kind: "workflow",
			title: "Flow",
			layout: "sequence",
			actors: [
				{ id: "x", label: "X" },
				{ id: "y", label: "Y" },
			],
			messages: [{ from: "x", to: "y", label: "call", tasks: ["T002"] }],
		},
	],
};

const file = "specs/004-effect-ledger/diagram.yaml";

function errorsOf(raw: unknown, feature = "004-effect-ledger"): string[] {
	try {
		validateSource(raw, file, feature);
	} catch (error) {
		if (error instanceof DiagramValidationError) return error.messages;
		throw error;
	}
	return [];
}

describe("validateSource", () => {
	it("accepts a valid source and applies defaults", () => {
		const source = validateSource(valid, file, "004-effect-ledger");
		const flow = source.diagrams[0];
		expect(flow?.layout).toBe("flow");
		if (flow?.layout !== "flow") throw new Error("expected flow");
		expect(flow.direction).toBe("LR");
		expect(flow.nodes[1]?.shape).toBe("database");
		expect(flow.nodes[1]?.tasks).toEqual([]);
		expect(flow.edges[0]?.style).toBe("solid");
	});

	it("rejects a feature that does not match its folder", () => {
		expect(errorsOf(valid, "005-fault-injection")).toEqual([
			`${file}:feature: expected "005-fault-injection" but found "004-effect-ledger"`,
		]);
	});

	it("reports schema errors with key paths", () => {
		const raw = structuredClone(valid);
		(raw.diagrams[0] as { nodes: { tasks?: string[] }[] }).nodes[0] = {
			...raw.diagrams[0]?.nodes?.[0],
			tasks: ["X1"],
		};
		const errors = errorsOf(raw);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatch(
			/^specs\/004-effect-ledger\/diagram\.yaml:diagrams\[0\]\.nodes\[0\]\.tasks\[0\]: /,
		);
	});

	it("rejects duplicate node ids", () => {
		const raw = structuredClone(valid);
		raw.diagrams[0]?.nodes?.push({ id: "a", label: "again" });
		expect(errorsOf(raw)).toContain(`${file}:diagrams[0].nodes[2].id: duplicate id "a"`);
	});

	it("rejects edges to unknown nodes", () => {
		const raw = structuredClone(valid);
		raw.diagrams[0]?.edges?.push({ from: "a", to: "ledgr" });
		expect(errorsOf(raw)).toContain(`${file}:diagrams[0].edges[1].to: unknown node "ledgr"`);
	});

	it("rejects unknown groups and unknown message actors", () => {
		const raw = structuredClone(valid);
		(raw.diagrams[0]?.nodes?.[1] as { group?: string }).group = "nope";
		raw.diagrams[1]?.messages?.push({ from: "x", to: "zz", label: "bad" });
		const errors = errorsOf(raw);
		expect(errors).toContain(`${file}:diagrams[0].nodes[1].group: unknown group "nope"`);
		expect(errors).toContain(`${file}:diagrams[1].messages[1].to: unknown actor "zz"`);
	});

	it("rejects sequence layout for non-workflow kinds", () => {
		const raw = structuredClone(valid);
		(raw.diagrams[1] as { kind: string }).kind = "hld";
		expect(errorsOf(raw).join("\n")).toMatch(/diagrams\[1\]\.kind/);
	});

	it("rejects duplicate diagram kinds", () => {
		const raw = structuredClone(valid);
		raw.diagrams.push(structuredClone(raw.diagrams[1] as (typeof raw.diagrams)[number]));
		expect(errorsOf(raw)).toContain(`${file}:diagrams[2].kind: duplicate diagram kind "workflow"`);
	});

	it("rejects duplicate task ids on one element", () => {
		const raw = structuredClone(valid);
		(raw.diagrams[0]?.nodes?.[0] as { tasks: string[] }).tasks = ["T001", "T001"];
		expect(errorsOf(raw)).toEqual([`${file}:diagrams[0].nodes[0].tasks: duplicate task id`]);
	});

	it("rejects unknown keys with an actionable hint", () => {
		const raw = structuredClone(valid) as Record<string, unknown>;
		raw["extra"] = 1;
		expect(errorsOf(raw)).toEqual([
			`${file}:extra: unknown key "extra" (quote values containing commas in { … } mappings)`,
		]);
	});

	it("accepts the architecture source name", () => {
		const raw = { ...structuredClone(valid), feature: "architecture" };
		expect(validateSource(raw, "docs/architecture/diagram.yaml", "architecture").feature).toBe(
			"architecture",
		);
	});
});
