/**
 * Base class for every error ReplayGuard throws. `code` is stable across versions and safe to
 * match on; `message` is for humans.
 *
 * @example
 * try { scenario().build(); } catch (e) { if (e instanceof ReplayGuardError) console.log(e.code); }
 */
export class ReplayGuardError extends Error {
	/** Stable machine-readable error code, e.g. `RG_CONFIG`. */
	readonly code: string;

	constructor(code: string, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = new.target.name;
		this.code = code;
	}
}

/**
 * Invalid configuration or input (bad scenario options, unhashable effect arguments, …).
 *
 * @example
 * throw new ConfigError("workflow is required", "RG_CONFIG_WORKFLOW");
 */
export class ConfigError extends ReplayGuardError {
	constructor(message: string, code = "RG_CONFIG", options?: ErrorOptions) {
		super(code, message, options);
	}
}

/**
 * Control-flow signal for a simulated crash: the "process" died at this point. Thrown into
 * workflow code by crash faults and by effects called from a dead run.
 *
 * @example
 * if (error instanceof CrashSignal) { // the host restarts the workflow }
 */
export class CrashSignal extends ReplayGuardError {
	constructor(message: string, options?: ErrorOptions) {
		super("RG_CRASH", message, options);
	}
}

/**
 * Failure of the test harness itself (not of the workflow under test), e.g. a child process
 * that could not start.
 *
 * @example
 * throw new HarnessError("child process exited before ready", { cause });
 */
export class HarnessError extends ReplayGuardError {
	constructor(message: string, options?: ErrorOptions) {
		super("RG_HARNESS", message, options);
	}
}

/**
 * A case exceeded its run or time budget.
 *
 * @example
 * throw new BudgetExceededError("case exceeded 20 runs");
 */
export class BudgetExceededError extends ReplayGuardError {
	constructor(message: string, options?: ErrorOptions) {
		super("RG_BUDGET", message, options);
	}
}

/**
 * Serialized data (e.g. a report) has an unsupported schema or version.
 *
 * @example
 * throw new SchemaError("report version 2 is not supported");
 */
export class SchemaError extends ReplayGuardError {
	constructor(message: string, code = "RG_SCHEMA", options?: ErrorOptions) {
		super(code, message, options);
	}
}

/** Plain-data form of an error, safe to store in snapshots and reports. */
export interface SerializedError {
	/** Error class name, or `NonError` for thrown non-errors. */
	name: string;
	/** Error message. */
	message: string;
	/** Stable error code when the error carried a string `code`. */
	code?: string;
}

/**
 * Converts anything thrown into plain data (name, message, string `code` when present).
 *
 * @example
 * serializeError(new TypeError("x")); // { name: "TypeError", message: "x" }
 */
export function serializeError(error: unknown): SerializedError {
	if (!(error instanceof Error)) return { name: "NonError", message: String(error) };
	const code = (error as { code?: unknown }).code;
	return typeof code === "string"
		? { name: error.name, message: error.message, code }
		: { name: error.name, message: error.message };
}
