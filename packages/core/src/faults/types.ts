import * as v from "valibot";
import { ConfigError } from "../errors.js";

/** Where around an effect a fault fires. */
export type FaultPoint = "before" | "after";

/** Anchor on the Nth attempt of an effect kind. */
export interface KindAnchor {
	/** Anchor discriminator. */
	type: "effect";
	/** Effect kind, matched exactly (e.g. `payment.charge`). */
	kind: string;
	/** 1-based occurrence among attempts of this kind (counted across runs). */
	occurrence: number;
}

/** Anchor on the Nth attempt of one logical effect identity. */
export interface IdentityAnchor {
	/** Anchor discriminator. */
	type: "effect";
	/** Logical identity, `kind::subject`. */
	identity: string;
	/** 1-based occurrence among attempts with this identity (counted across runs). */
	occurrence: number;
}

/** Anchor on an effect attempt. */
export type EffectAnchor = KindAnchor | IdentityAnchor;

/** Anchor on the Nth durable write performed by the workflow engine. */
export interface WriteAnchor {
	/** Anchor discriminator. */
	type: "write";
	/** 1-based write index. */
	index: number;
}

/** Any fault anchor. */
export type FaultAnchor = EffectAnchor | WriteAnchor;

/** No fault (baseline). */
export interface NoFaultSpec {
	/** Strategy name. */
	strategy: "none";
}

/** In-process crash at an effect or durable write. */
export interface CrashSpec {
	/** Strategy name. */
	strategy: "crash";
	/** Where the crash happens. */
	anchor: FaultAnchor;
	/** Before or after the anchored effect (default `after`); not allowed for write anchors. */
	point?: FaultPoint;
}

/** Lost response: the effect applies, the caller gets an error. */
export interface ThrowAfterSpec {
	/** Strategy name. */
	strategy: "throwAfter";
	/** The effect whose response is lost. */
	anchor: EffectAnchor;
	/** Error to throw (default `SimulatedNetworkError`). */
	error?: () => Error;
}

/** Provider hang: the effect stays in flight for `delayMs`. */
export interface DelaySpec {
	/** Strategy name. */
	strategy: "delay";
	/** The effect that hangs. */
	anchor: EffectAnchor;
	/** Hang duration in milliseconds (1–600000). */
	delayMs: number;
}

/** Real process kill at an effect or durable write (process-isolated runtimes). */
export interface ProcessKillSpec {
	/** Strategy name. */
	strategy: "processKill";
	/** Where the kill happens. */
	anchor: FaultAnchor;
	/** Before or after the anchored effect (default `after`); not allowed for write anchors. */
	point?: FaultPoint;
}

/** A fault to inject; see `fault` for helpers. */
export type FaultSpec = NoFaultSpec | CrashSpec | ThrowAfterSpec | DelaySpec | ProcessKillSpec;

/** Name of a fault strategy. */
export type StrategyName = FaultSpec["strategy"];

/** Whether and when an armed fault fired. */
export interface FaultOutcome {
	/** Index of the spec in the case's fault list. */
	specIndex: number;
	/** Strategy that was armed. */
	strategy: StrategyName;
	/** Whether the fault fired. */
	triggered: boolean;
	/** Ledger fault ID when triggered. */
	faultId?: string;
	/** Run in which the fault fired. */
	runIndex?: number;
	/** Clock time when the fault fired. */
	at?: number;
}

const Occurrence = v.pipe(v.number(), v.integer(), v.minValue(1));
const Name = v.pipe(v.string(), v.minLength(1));
const EffectAnchorSchema = v.union(
	[
		v.strictObject({ type: v.literal("effect"), kind: Name, occurrence: Occurrence }),
		v.strictObject({ type: v.literal("effect"), identity: Name, occurrence: Occurrence }),
	],
	"effect anchor needs exactly one of `kind` or `identity` and an integer `occurrence` ≥ 1",
);
const WriteAnchorSchema = v.strictObject({ type: v.literal("write"), index: Occurrence });
const AnyAnchor = v.union([EffectAnchorSchema, WriteAnchorSchema], "invalid anchor");
const Point = v.optional(v.picklist(["before", "after"]));
const FaultSpecSchema = v.pipe(
	v.variant(
		"strategy",
		[
			v.strictObject({ strategy: v.literal("none") }),
			v.strictObject({ strategy: v.literal("crash"), anchor: AnyAnchor, point: Point }),
			v.strictObject({
				strategy: v.literal("throwAfter"),
				anchor: EffectAnchorSchema,
				error: v.optional(v.function()),
			}),
			v.strictObject({
				strategy: v.literal("delay"),
				anchor: EffectAnchorSchema,
				delayMs: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(600_000)),
			}),
			v.strictObject({ strategy: v.literal("processKill"), anchor: AnyAnchor, point: Point }),
		],
		"unknown fault strategy",
	),
	v.check(
		(spec) => !("point" in spec && spec.point !== undefined && spec.anchor.type === "write"),
		"point applies to effect anchors only",
	),
);

/**
 * Validates a fault spec, throwing `ConfigError` with the offending path.
 *
 * @example
 * validateFaultSpec(fault.crashAfter("payment.charge"));
 */
export function validateFaultSpec(spec: unknown): FaultSpec {
	const result = v.safeParse(FaultSpecSchema, spec);
	if (!result.success) {
		const issue = result.issues[0] as v.BaseIssue<unknown>;
		const path = (issue.path ?? []).map((p) => String(p.key)).join(".");
		throw new ConfigError(
			`invalid fault spec${path ? ` at ${path}` : ""}: ${issue.message}`,
			"RG_CONFIG_FAULT",
		);
	}
	return spec as FaultSpec;
}

function target(anchor: EffectAnchor): string {
	return `${"kind" in anchor ? anchor.kind : anchor.identity}#${anchor.occurrence}`;
}

function where(anchor: FaultAnchor, point: FaultPoint | undefined): string {
	return anchor.type === "write"
		? `at durable write #${anchor.index}`
		: `${point ?? "after"} ${target(anchor)}`;
}

/**
 * Human-readable description, e.g. `crash after payment.charge#1`.
 *
 * @example
 * describeFault(fault.delay("payment", 80)); // "delay 80ms in payment#1"
 */
export function describeFault(spec: FaultSpec): string {
	switch (spec.strategy) {
		case "none":
			return "no fault";
		case "crash":
			return `crash ${where(spec.anchor, spec.point)}`;
		case "throwAfter":
			return `lost response after ${target(spec.anchor)}`;
		case "delay":
			return `delay ${spec.delayMs}ms in ${target(spec.anchor)}`;
		case "processKill":
			return `process kill ${where(spec.anchor, spec.point)}`;
	}
}

const effect = (kind: string, occurrence: number): EffectAnchor => ({
	type: "effect",
	kind,
	occurrence,
});

/**
 * Helpers for common faults (kinds match an attempt's `kind` exactly).
 *
 * @example
 * scenario().case("crash after charge", [fault.crashAfter("payment.charge")]);
 */
export const fault = {
	/** No fault (baseline). */
	none: (): FaultSpec => ({ strategy: "none" }),
	/** Crash right after the Nth attempt of `kind` was applied by the provider. */
	crashAfter: (kind: string, occurrence = 1): FaultSpec => ({
		strategy: "crash",
		anchor: effect(kind, occurrence),
		point: "after",
	}),
	/** Crash right before the Nth attempt of `kind` reaches the provider. */
	crashBefore: (kind: string, occurrence = 1): FaultSpec => ({
		strategy: "crash",
		anchor: effect(kind, occurrence),
		point: "before",
	}),
	/** Crash before the Nth durable write. */
	crashAtWrite: (index: number): FaultSpec => ({
		strategy: "crash",
		anchor: { type: "write", index },
	}),
	/** The provider applies the Nth attempt of `kind`, but the caller receives an error. */
	loseResponse: (kind: string, occurrence = 1, error?: () => Error): FaultSpec =>
		error === undefined
			? { strategy: "throwAfter", anchor: effect(kind, occurrence) }
			: { strategy: "throwAfter", anchor: effect(kind, occurrence), error },
	/** The provider hangs for `delayMs` on the Nth attempt of `kind` (the call keeps running). */
	delay: (kind: string, delayMs: number, occurrence = 1): FaultSpec => ({
		strategy: "delay",
		anchor: effect(kind, occurrence),
		delayMs,
	}),
	/** Kill the real process right after the Nth attempt of `kind` (process-isolated runtimes). */
	killAfter: (kind: string, occurrence = 1): FaultSpec => ({
		strategy: "processKill",
		anchor: effect(kind, occurrence),
		point: "after",
	}),
};
