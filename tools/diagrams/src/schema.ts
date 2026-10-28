import * as v from "valibot";

const Id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*$/, "must match ^[a-z][a-z0-9-]*$"));
const TaskId = v.pipe(v.string(), v.regex(/^T\d{3,}$/, "must match ^T\\d{3,}$"));
const Tasks = v.optional(
	v.pipe(
		v.array(TaskId),
		v.check((ids) => new Set(ids).size === ids.length, "duplicate task id"),
	),
	[],
);
const text = (min: number, max: number) =>
	v.pipe(
		v.string(),
		v.minLength(min, `must be at least ${min} chars`),
		v.maxLength(max, `must be at most ${max} chars`),
	);

const Node = v.strictObject({
	id: Id,
	label: text(1, 80),
	shape: v.optional(v.picklist(["box", "ellipse", "diamond", "database", "package"]), "box"),
	group: v.optional(Id),
	tasks: Tasks,
	note: v.optional(text(1, 120)),
});

const Edge = v.strictObject({
	from: Id,
	to: Id,
	label: v.optional(text(1, 40)),
	style: v.optional(v.picklist(["solid", "dashed"]), "solid"),
});

const Group = v.strictObject({ id: Id, label: text(1, 60) });
const Actor = v.strictObject({ id: Id, label: text(1, 60) });
const Message = v.strictObject({
	from: Id,
	to: Id,
	label: text(1, 80),
	tasks: Tasks,
	style: v.optional(v.picklist(["solid", "dashed"]), "solid"),
});

const FlowDiagram = v.strictObject({
	kind: v.picklist(["hld", "lld", "workflow", "architecture"]),
	title: text(1, 120),
	layout: v.literal("flow"),
	direction: v.optional(v.picklist(["LR", "TB"]), "LR"),
	groups: v.optional(v.array(Group), []),
	nodes: v.pipe(
		v.array(Node),
		v.minLength(1, "needs at least 1 node"),
		v.maxLength(40, "at most 40 nodes"),
	),
	edges: v.optional(v.pipe(v.array(Edge), v.maxLength(80, "at most 80 edges")), []),
});

const SequenceDiagram = v.strictObject({
	kind: v.literal("workflow", 'sequence layout is only allowed for kind "workflow"'),
	title: text(1, 120),
	layout: v.literal("sequence"),
	actors: v.pipe(
		v.array(Actor),
		v.minLength(2, "needs at least 2 actors"),
		v.maxLength(10, "at most 10 actors"),
	),
	messages: v.pipe(
		v.array(Message),
		v.minLength(1, "needs at least 1 message"),
		v.maxLength(60, "at most 60 messages"),
	),
});

const Diagram = v.variant(
	"layout",
	[FlowDiagram, SequenceDiagram],
	'layout must be "flow" or "sequence"',
);

const Source = v.strictObject({
	feature: v.pipe(
		v.string(),
		v.regex(/^(\d{3}-[a-z0-9-]+|architecture)$/, "must be NNN-name or architecture"),
	),
	diagrams: v.pipe(
		v.array(Diagram),
		v.minLength(1, "needs at least 1 diagram"),
		v.maxLength(4, "at most 4 diagrams"),
	),
});

export type DiagramSource = v.InferOutput<typeof Source>;
export type DiagramDefinition = DiagramSource["diagrams"][number];
export type FlowDefinition = Extract<DiagramDefinition, { layout: "flow" }>;
export type SequenceDefinition = Extract<DiagramDefinition, { layout: "sequence" }>;
export type DiagramKind = DiagramDefinition["kind"];
export type NodeDefinition = FlowDefinition["nodes"][number];

/** Thrown when a diagram source fails validation; `messages` are `file:keyPath: message` lines. */
export class DiagramValidationError extends Error {
	readonly messages: string[];

	constructor(messages: string[]) {
		super(messages.join("\n"));
		this.name = "DiagramValidationError";
		this.messages = messages;
	}
}

function keyPath(path: readonly { key: unknown }[] | undefined): string {
	let out = "";
	for (const item of path ?? []) {
		out += typeof item.key === "number" ? `[${item.key}]` : `${out ? "." : ""}${String(item.key)}`;
	}
	return out;
}

function crossCheck(source: DiagramSource, at: (path: string, message: string) => void): void {
	const kinds = new Set<string>();
	source.diagrams.forEach((diagram, d) => {
		const base = `diagrams[${d}]`;
		if (kinds.has(diagram.kind)) at(`${base}.kind`, `duplicate diagram kind "${diagram.kind}"`);
		kinds.add(diagram.kind);
		if (diagram.layout === "flow") {
			const groups = new Set(diagram.groups.map((g) => g.id));
			const nodes = new Set<string>();
			diagram.nodes.forEach((node, n) => {
				if (nodes.has(node.id)) at(`${base}.nodes[${n}].id`, `duplicate id "${node.id}"`);
				nodes.add(node.id);
				if (node.group !== undefined && !groups.has(node.group)) {
					at(`${base}.nodes[${n}].group`, `unknown group "${node.group}"`);
				}
			});
			diagram.edges.forEach((edge, e) => {
				for (const end of ["from", "to"] as const) {
					if (!nodes.has(edge[end]))
						at(`${base}.edges[${e}].${end}`, `unknown node "${edge[end]}"`);
				}
			});
		} else {
			const actors = new Set<string>();
			diagram.actors.forEach((actor, a) => {
				if (actors.has(actor.id)) at(`${base}.actors[${a}].id`, `duplicate id "${actor.id}"`);
				actors.add(actor.id);
			});
			diagram.messages.forEach((message, m) => {
				for (const end of ["from", "to"] as const) {
					if (!actors.has(message[end])) {
						at(`${base}.messages[${m}].${end}`, `unknown actor "${message[end]}"`);
					}
				}
			});
		}
	});
}

/**
 * Validates a parsed `diagram.yaml` document.
 *
 * @example
 * const source = validateSource(YAML.parse(text), "specs/004-x/diagram.yaml", "004-x");
 */
export function validateSource(raw: unknown, file: string, expectedFeature: string): DiagramSource {
	const result = v.safeParse(Source, raw);
	if (!result.success) {
		throw new DiagramValidationError(
			result.issues.map((issue) => {
				const message =
					issue.type === "strict_object"
						? `unknown key ${issue.received} (quote values containing commas in { … } mappings)`
						: issue.message;
				return `${file}:${keyPath(issue.path) || "(root)"}: ${message}`;
			}),
		);
	}
	const messages: string[] = [];
	const at = (path: string, message: string) => messages.push(`${file}:${path}: ${message}`);
	if (result.output.feature !== expectedFeature) {
		at("feature", `expected "${expectedFeature}" but found "${result.output.feature}"`);
	}
	crossCheck(result.output, at);
	if (messages.length > 0) throw new DiagramValidationError(messages);
	return result.output;
}
