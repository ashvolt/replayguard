import type { WorkflowContext } from "rivetkit/workflow";

/** Placeholder for the RivetKit actor type parameters ReplayGuard does not model. */
// biome-ignore lint/suspicious/noExplicitAny: RivetKit's context has eight type parameters; only state is modelled
export type OpenActorType = any;

/** RivetKit workflow context for an actor with state `TState` (other actor types left open). */
export type ActorWorkflowContext<TState = undefined> = WorkflowContext<
	TState,
	OpenActorType,
	OpenActorType,
	OpenActorType,
	OpenActorType,
	OpenActorType
>;

/** Actor options besides `run`, passed through to RivetKit's `actor()`. */
export interface ActorWorkflowConfig<TState = undefined> {
	/** Initial actor state (reachable inside steps via `step.state`). */
	state?: TState;
	/** Extra actor actions. */
	actions?: Record<string, (...args: never[]) => unknown>;
	/** Any other RivetKit actor option. */
	[option: string]: unknown;
}

/** A workflow function plus actor options, run by `rivetkitRuntime()` inside a real actor. */
export interface ActorWorkflow<TState = undefined> {
	/** Marker. */
	readonly kind: "replayguard.actor-workflow";
	/** The workflow body (RivetKit API: steps receive a step context). */
	readonly fn: (ctx: ActorWorkflowContext<TState>) => Promise<unknown>;
	/** Actor options. */
	readonly config: ActorWorkflowConfig<TState>;
}

/**
 * Describes the workflow actor a scenario runs on RivetKit. ReplayGuard builds the actor around
 * it, so it can observe completion and failure; return it from the scenario's `.workflow()`.
 *
 * @example
 * .workflow(({ payment }) =>
 *   actorWorkflow(async (ctx) => {
 *     await ctx.step("charge", (step) => payment.charge({ orderId: step.state.orderId, amount: 500 }));
 *   }, { state: { orderId: "o-1" } }))
 */
export function actorWorkflow<TState = undefined>(
	fn: (ctx: ActorWorkflowContext<TState>) => Promise<unknown>,
	config: ActorWorkflowConfig<TState> = {},
): ActorWorkflow<TState> {
	return Object.freeze({ kind: "replayguard.actor-workflow", fn, config });
}

/**
 * Whether a value was created by `actorWorkflow()`.
 *
 * @example
 * if (!isActorWorkflow(def.workflow(effects))) throw new Error("wrong workflow type");
 */
export function isActorWorkflow(value: unknown): value is ActorWorkflow<unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { kind?: unknown }).kind === "replayguard.actor-workflow"
	);
}
