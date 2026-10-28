import type { DiagramDefinition } from "../schema.ts";
import { layoutFlow } from "./flow.ts";
import { layoutSequence } from "./sequence.ts";
import type { LaidOutDiagram } from "./types.ts";

/** Strategy dispatch on the diagram's `layout`. */
export function layoutDiagram(def: DiagramDefinition, feature: string): LaidOutDiagram {
	return def.layout === "flow" ? layoutFlow(def, feature) : layoutSequence(def, feature);
}
