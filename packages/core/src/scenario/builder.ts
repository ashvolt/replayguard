import { classify } from "../classifier/classify.js";
import { validatePolicy } from "../classifier/policy.js";
import type { ClassifiedResult, Policy } from "../classifier/types.js";
import { ConfigError } from "../errors.js";
import { type FaultSpec, validateFaultSpec } from "../faults/types.js";
import type { WorkflowRuntime } from "../runtime/port.js";
import type { ScenarioResult } from "./result.js";
import { type RunOptions, ScenarioRunner } from "./runner.js";
import { validateScenarioOptions } from "./schema.js";
import {
	type Budget,
	type CaseDefinition,
	DEFAULT_BUDGET,
	DEFAULT_EXPLORE,
	type EffectContext,
	type ExploreOptions,
	type ScenarioDefinition,
	type ScriptedMessage,
} from "./types.js";

/** A validated scenario ready to run. */
export interface Scenario<TEffects = unknown, TWorkflow = unknown, TInput = unknown> {
	/** Immutable definition. */
	readonly definition: Readonly<ScenarioDefinition<TEffects, TWorkflow, TInput>>;
	/** Runs baseline, explicit and explored cases. */
	run(options?: RunOptions & { classify?: false }): Promise<ScenarioResult>;
	/** Runs and classifies with the given policy (validated before running). */
	run(options: ClassifyRunOptions): Promise<ClassifiedResult>;
}

/** Run options that also classify the result. */
export interface ClassifyRunOptions extends RunOptions {
	/** Classify the result. */
	classify: true;
	/** Verdict policy (default: strict). */
	policy?: Policy;
}

interface State {
	name: string;
	runtime: WorkflowRuntime<unknown, unknown> | undefined;
	workflowId: string;
	effects: ((ctx: EffectContext) => unknown) | undefined;
	workflow: ((effects: unknown) => unknown) | undefined;
	input: unknown;
	cases: CaseDefinition[];
	explore: ExploreOptions | false;
	budget: Budget;
	seed: number;
	messages: ScriptedMessage[];
}

const INITIAL: State = {
	name: "scenario",
	runtime: undefined,
	workflowId: "replayguard-wf",
	effects: undefined,
	workflow: undefined,
	input: undefined,
	cases: [],
	explore: false,
	budget: DEFAULT_BUDGET,
	seed: 1,
	messages: [],
};

/**
 * Fluent, immutable scenario builder (Builder pattern); `build()` validates everything.
 *
 * @example
 * const s = scenario()
 *   .runtime(workflowsRuntime())
 *   .effects((ctx) => ({ payment: createFakePayment(ctx) }))
 *   .workflow(({ payment }) => async (wf) => wf.step("charge", () => payment.charge(req)))
 *   .case("crash after charge", [fault.crashAfter("payment.charge")])
 *   .build();
 */
export class ScenarioBuilder<TEffects = never, TWorkflow = never, TInput = undefined> {
	readonly #state: State;

	private constructor(state: State) {
		this.#state = state;
	}

	/** Starts an empty builder (use `scenario()`). */
	static create(): ScenarioBuilder {
		return new ScenarioBuilder(INITIAL);
	}

	#with<E = TEffects, W = TWorkflow, I = TInput>(patch: Partial<State>): ScenarioBuilder<E, W, I> {
		return new ScenarioBuilder<E, W, I>({ ...this.#state, ...patch });
	}

	/** Scenario name (1–120 chars). */
	name(name: string): ScenarioBuilder<TEffects, TWorkflow, TInput> {
		return this.#with({ name });
	}

	/** Workflow runtime adapter. */
	runtime<W, I = TInput>(runtime: WorkflowRuntime<W, I>): ScenarioBuilder<TEffects, W, TInput> {
		return this.#with<TEffects, W, TInput>({
			runtime: runtime as WorkflowRuntime<unknown, unknown>,
		});
	}

	/** Effects factory, called once per case with a fresh context. */
	effects<E>(factory: (ctx: EffectContext) => E): ScenarioBuilder<E, TWorkflow, TInput> {
		return this.#with<E, TWorkflow, TInput>({ effects: factory });
	}

	/** Workflow factory, called once per case with that case's effects. */
	workflow(
		factory: (effects: TEffects) => TWorkflow,
	): ScenarioBuilder<TEffects, TWorkflow, TInput> {
		return this.#with({ workflow: factory as (effects: unknown) => unknown });
	}

	/** Workflow input. */
	input<I>(input: I): ScenarioBuilder<TEffects, TWorkflow, I> {
		return this.#with<TEffects, TWorkflow, I>({ input });
	}

	/** Stable workflow ID (keys derived from it stay stable across restarts). */
	workflowId(id: string): ScenarioBuilder<TEffects, TWorkflow, TInput> {
		return this.#with({ workflowId: id });
	}

	/** Adds a named explicit case. */
	case(name: string, faults: readonly FaultSpec[]): ScenarioBuilder<TEffects, TWorkflow, TInput> {
		return this.#with({ cases: [...this.#state.cases, { name, faults }] });
	}

	/** Adds an unnamed explicit case (`explicit #N`). */
	faults(faults: readonly FaultSpec[]): ScenarioBuilder<TEffects, TWorkflow, TInput> {
		return this.case(`explicit #${this.#state.cases.length + 1}`, faults);
	}

	/** Enables automatic fault exploration. */
	explore(options: Partial<ExploreOptions> = {}): ScenarioBuilder<TEffects, TWorkflow, TInput> {
		return this.#with({ explore: { ...DEFAULT_EXPLORE, ...options } });
	}

	/** Overrides per-case limits. */
	budget(budget: Partial<Budget>): ScenarioBuilder<TEffects, TWorkflow, TInput> {
		return this.#with({ budget: { ...this.#state.budget, ...budget } });
	}

	/** Seed for randomized choices. */
	seed(seed: number): ScenarioBuilder<TEffects, TWorkflow, TInput> {
		return this.#with({ seed });
	}

	/** Delivers a message when the workflow waits (optionally only after run `afterRun`). */
	deliver(
		name: string,
		body: unknown,
		afterRun?: number,
	): ScenarioBuilder<TEffects, TWorkflow, TInput> {
		const message: ScriptedMessage =
			afterRun === undefined ? { name, body } : { name, body, afterRun };
		return this.#with({ messages: [...this.#state.messages, message] });
	}

	/** Validates and freezes the scenario; throws `ConfigError`. */
	build(): Scenario<TEffects, TWorkflow, TInput> {
		const s = this.#state;
		if (!s.runtime)
			throw new ConfigError("runtime is required: call .runtime(...)", "RG_CONFIG_SCENARIO");
		if (!s.effects)
			throw new ConfigError(
				"effects factory is required: call .effects(...)",
				"RG_CONFIG_SCENARIO",
			);
		if (!s.workflow)
			throw new ConfigError(
				"workflow factory is required: call .workflow(...)",
				"RG_CONFIG_SCENARIO",
			);
		validateScenarioOptions({
			name: s.name,
			workflowId: s.workflowId,
			seed: s.seed,
			budget: s.budget,
			explore: s.explore,
			messages: s.messages,
		});
		const names = new Set<string>();
		for (const c of s.cases) {
			if (c.name.length < 1 || c.name.length > 120) {
				throw new ConfigError("case name must be 1–120 chars", "RG_CONFIG_SCENARIO");
			}
			if (names.has(c.name))
				throw new ConfigError(`duplicate case name "${c.name}"`, "RG_CONFIG_SCENARIO");
			names.add(c.name);
			for (const spec of c.faults) validateFaultSpec(spec);
		}
		const wantsKill =
			s.cases.some((c) => c.faults.some((f) => f.strategy === "processKill")) ||
			(s.explore !== false && s.explore.strategies.includes("processKill"));
		if (wantsKill && !s.runtime.processIsolated) {
			throw new ConfigError(
				"processKill requires a process-isolated runtime",
				"RG_CONFIG_SCENARIO",
			);
		}
		const definition = Object.freeze({ ...s }) as unknown as ScenarioDefinition<
			TEffects,
			TWorkflow,
			TInput
		>;
		return {
			definition,
			run: (async (options: RunOptions & { classify?: boolean; policy?: Policy } = {}) => {
				const { classify: wantsClassify, policy = {}, ...runOptions } = options;
				if (wantsClassify) validatePolicy(policy);
				const result = await new ScenarioRunner(definition, runOptions).run();
				return wantsClassify ? classify(result, policy) : result;
			}) as Scenario<TEffects, TWorkflow, TInput>["run"],
		};
	}
}

/**
 * Starts a scenario definition.
 *
 * @example
 * const result = await scenario().runtime(rt).effects(fx).workflow(wf).explore().build().run();
 */
export function scenario(): ScenarioBuilder {
	return ScenarioBuilder.create();
}
