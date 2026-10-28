import { type ChildIo, createCheckpointClient } from "@replayguard/adapter-workflows";
import {
	createEffectContext,
	EffectLedger,
	HarnessError,
	type RunOutcome,
	type ScenarioDefinition,
	type SerializedError,
	systemClock,
	systemSleeper,
} from "@replayguard/core";
import * as v from "valibot";
import { type ActorWorkflowConfig, isActorWorkflow } from "../actor-workflow.js";

/** Registry key of the actor ReplayGuard builds around the scenario's workflow. */
export const REPLAYGUARD_ACTOR = "replayguardWorkflow";

const Int = v.pipe(v.number(), v.integer(), v.minValue(0));

/** Parent → actor host: start (or resume) the workflow actor for one run. */
export interface ActorInit {
	/** Discriminator. */
	type: "init";
	/** Case index (0 = baseline). */
	caseIndex: number;
	/** Workflow ID (used as the actor key). */
	workflowId: string;
	/** `RIVETKIT_STORAGE_PATH` shared by every run of the case. */
	storageDir: string;
	/** Engine base port. */
	enginePort: number;
	/** File URL of the scenario module. */
	scenarioModule: string;
	/** Export returning the built scenario. */
	exportName: string;
	/** JSON-serializable workflow input. */
	input?: unknown;
}

const actorInit = v.strictObject({
	type: v.literal("init"),
	caseIndex: Int,
	workflowId: v.string(),
	storageDir: v.string(),
	enginePort: v.pipe(Int, v.maxValue(65_535)),
	scenarioModule: v.string(),
	exportName: v.string(),
	input: v.exactOptional(v.unknown()),
});

// Compile-time check that the schema and the interface agree.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const initMatches: Equal<v.InferOutput<typeof actorInit>, ActorInit> = true;
void initMatches;

/** Valibot schema of {@link ActorInit}. */
export const ActorInitSchema: v.GenericSchema<unknown, ActorInit> = actorInit;

/** A RivetKit step error event. */
export interface StepErrorEventLike {
	/** Step failure details. */
	step: {
		/** Whether the engine will retry the step. */
		willRetry: boolean;
		/** The error. */
		error: WorkflowErrorLike;
	};
}

/** A RivetKit workflow-level error event. */
export interface WorkflowRunErrorEventLike {
	/** Workflow failure details. */
	workflow: {
		/** The error. */
		error: WorkflowErrorLike;
	};
}

/** A RivetKit rollback error event (ignored by ReplayGuard). */
export interface RollbackErrorEventLike {
	/** Rollback failure details. */
	rollback: {
		/** The error. */
		error: WorkflowErrorLike;
	};
}

/** A RivetKit workflow error event (subset ReplayGuard reads). */
export type WorkflowErrorEventLike =
	| StepErrorEventLike
	| WorkflowRunErrorEventLike
	| RollbackErrorEventLike;

/** A RivetKit workflow error (subset ReplayGuard reads). */
export interface WorkflowErrorLike {
	/** Error name. */
	name: string;
	/** Error message. */
	message: string;
	/** Stack trace, if any (not reported). */
	stack?: string;
}

/** What the RivetKit launcher needs to host the workflow actor. */
export interface ActorLaunchParams {
	/** Registry key of the actor. */
	actorName: string;
	/** Actor key (the workflow ID). */
	key: string[];
	/** Workflow body to pass to RivetKit's `workflow()`. */
	run(ctx: unknown): Promise<unknown>;
	/** Error handler to pass to RivetKit's `workflow(fn, { onError })`. */
	onError(event: WorkflowErrorEventLike): void;
	/** Actor options from `actorWorkflow()`. */
	config: ActorWorkflowConfig<unknown>;
	/** `RIVETKIT_STORAGE_PATH` for the registry and engine. */
	storageDir: string;
	/** Engine base port. */
	enginePort: number;
	/** Workflow input (actor create input). */
	input: unknown;
}

/** Injectable effects of the actor host. */
export interface ActorHostDeps {
	/** Loads the scenario module. */
	importModule(specifier: string): Promise<Record<string, unknown>>;
	/** Starts the registry (and engine, if needed) and wakes the actor. */
	launch(params: ActorLaunchParams): Promise<void>;
}

const plainError = (e: { name: string; message: string }): SerializedError => ({
	name: e.name,
	message: e.message,
});

/**
 * Runs inside the actor host process: rebuilds the scenario, wraps its `actorWorkflow` so the
 * outcome is observable, launches the actor and relays every effect checkpoint to the parent.
 * After reporting the outcome it keeps running until in-flight effects settle.
 *
 * @example
 * void runActorHost(io, { importModule: (s) => import(s), launch: launchRivetKitActor });
 */
export async function runActorHost(io: ChildIo, deps: ActorHostDeps): Promise<void> {
	const client = createCheckpointClient(io);
	try {
		const parsed = v.safeParse(ActorInitSchema, await client.init);
		if (!parsed.success) {
			throw new HarnessError(`invalid init message: ${parsed.issues[0]?.message}`);
		}
		const init = parsed.output;
		const factory = (await deps.importModule(init.scenarioModule))[init.exportName];
		if (typeof factory !== "function") {
			throw new HarnessError(`scenario module does not export a function "${init.exportName}"`);
		}
		const def = (factory() as { definition?: ScenarioDefinition }).definition;
		if (!def || typeof def.effects !== "function" || typeof def.workflow !== "function") {
			throw new HarnessError(`"${init.exportName}" must return a built scenario`);
		}
		const ledger = new EffectLedger();
		ledger.addHooks(client.hooks);
		const workflow = def.workflow(
			def.effects(createEffectContext(ledger, systemClock, systemSleeper, init.caseIndex)),
		);
		if (!isActorWorkflow(workflow)) {
			throw new HarnessError(
				"the scenario's workflow must return actorWorkflow(fn, config) for the RivetKit runtime",
			);
		}
		type Reported = Exclude<RunOutcome, { state: "crashed" }>;
		let resolveOutcome!: (outcome: Reported) => void;
		const outcome = new Promise<Reported>((resolve) => {
			resolveOutcome = resolve;
		});
		let reported = false;
		const report = (o: Reported) => {
			if (!reported) {
				reported = true;
				resolveOutcome(o);
			}
		};
		await deps.launch({
			actorName: REPLAYGUARD_ACTOR,
			key: [init.workflowId],
			async run(ctx) {
				const output = await workflow.fn(ctx as never);
				report({ state: "completed", output });
				return output;
			},
			onError(event) {
				if ("step" in event && !event.step.willRetry) {
					report({ state: "failed", error: plainError(event.step.error) });
				} else if ("workflow" in event) {
					report({ state: "failed", error: plainError(event.workflow.error) });
				}
			},
			config: workflow.config,
			storageDir: init.storageDir,
			enginePort: init.enginePort,
			input: init.input,
		});
		await io.send({ type: "run-ended", outcome: await outcome });
		await client.settled();
	} catch (error) {
		await io.send({
			type: "harness-error",
			message: error instanceof Error ? (error.stack ?? error.message) : String(error),
		});
	}
}
