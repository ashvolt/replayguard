import { describe, expect, it } from "vitest";
import { ConfigError } from "../../src/errors.js";
import { describeFault, fault, validateFaultSpec } from "../../src/faults/types.js";

describe("fault helpers", () => {
	it("build the documented specs", () => {
		expect(fault.none()).toEqual({ strategy: "none" });
		expect(fault.crashAfter("payment")).toEqual({
			strategy: "crash",
			anchor: { type: "effect", kind: "payment", occurrence: 1 },
			point: "after",
		});
		expect(fault.crashBefore("payment", 2)).toEqual({
			strategy: "crash",
			anchor: { type: "effect", kind: "payment", occurrence: 2 },
			point: "before",
		});
		expect(fault.crashAtWrite(3)).toEqual({
			strategy: "crash",
			anchor: { type: "write", index: 3 },
		});
		expect(fault.loseResponse("email")).toEqual({
			strategy: "throwAfter",
			anchor: { type: "effect", kind: "email", occurrence: 1 },
		});
		const error = () => new Error("timeout");
		expect(fault.loseResponse("email", 2, error)).toEqual({
			strategy: "throwAfter",
			anchor: { type: "effect", kind: "email", occurrence: 2 },
			error,
		});
		expect(fault.loseRequest("email")).toEqual({
			strategy: "throwAfter",
			anchor: { type: "effect", kind: "email", occurrence: 1 },
			point: "before",
		});
		expect(fault.loseRequest("email", 1, error)).toMatchObject({ point: "before", error });
		expect(fault.delay("payment", 500)).toEqual({
			strategy: "delay",
			anchor: { type: "effect", kind: "payment", occurrence: 1 },
			delayMs: 500,
		});
		expect(fault.killAfter("payment")).toEqual({
			strategy: "processKill",
			anchor: { type: "effect", kind: "payment", occurrence: 1 },
			point: "after",
		});
	});

	it("describe faults for humans", () => {
		expect(describeFault(fault.none())).toBe("no fault");
		expect(describeFault(fault.crashAfter("payment.charge"))).toBe("crash after payment.charge#1");
		expect(describeFault(fault.crashBefore("payment", 2))).toBe("crash before payment#2");
		expect(describeFault(fault.crashAtWrite(3))).toBe("crash at durable write #3");
		expect(describeFault(fault.loseResponse("email"))).toBe("lost response after email#1");
		expect(describeFault(fault.loseRequest("email"))).toBe("lost request before email#1");
		expect(describeFault(fault.delay("payment", 80))).toBe("delay 80ms in payment#1");
		expect(describeFault(fault.killAfter("payment"))).toBe("process kill after payment#1");
		expect(
			describeFault({
				strategy: "crash",
				anchor: { type: "effect", identity: "payment::o-1", occurrence: 1 },
			}),
		).toBe("crash after payment::o-1#1");
	});
});

describe("validateFaultSpec", () => {
	const bad = (spec: unknown) => {
		try {
			validateFaultSpec(spec);
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigError);
			return (error as ConfigError).message;
		}
		throw new Error("expected a ConfigError");
	};

	it("accepts every helper's output", () => {
		for (const spec of [
			fault.none(),
			fault.crashAfter("p"),
			fault.crashAtWrite(1),
			fault.loseResponse("p"),
			fault.delay("p", 1),
			fault.killAfter("p"),
		]) {
			expect(validateFaultSpec(spec)).toBe(spec);
		}
	});

	it.each([
		[
			"both kind and identity",
			{ strategy: "crash", anchor: { type: "effect", kind: "a", identity: "a::b", occurrence: 1 } },
		],
		["neither kind nor identity", { strategy: "crash", anchor: { type: "effect", occurrence: 1 } }],
		[
			"occurrence below 1",
			{ strategy: "crash", anchor: { type: "effect", kind: "a", occurrence: 0 } },
		],
		[
			"non-integer occurrence",
			{ strategy: "crash", anchor: { type: "effect", kind: "a", occurrence: 1.5 } },
		],
		[
			"write anchor for throwAfter",
			{ strategy: "throwAfter", anchor: { type: "write", index: 1 } },
		],
		[
			"write anchor for delay",
			{ strategy: "delay", anchor: { type: "write", index: 1 }, delayMs: 5 },
		],
		[
			"delayMs too large",
			{ strategy: "delay", anchor: { type: "effect", kind: "a", occurrence: 1 }, delayMs: 600_001 },
		],
		[
			"delayMs zero",
			{ strategy: "delay", anchor: { type: "effect", kind: "a", occurrence: 1 }, delayMs: 0 },
		],
		[
			"point with write anchor",
			{ strategy: "crash", anchor: { type: "write", index: 1 }, point: "after" },
		],
		["unknown strategy", { strategy: "explode" }],
		["write index below 1", { strategy: "crash", anchor: { type: "write", index: 0 } }],
	])("rejects %s", (_label, spec) => {
		expect(bad(spec)).toMatch(/^invalid fault spec/);
	});

	it("names the offending path", () => {
		expect(
			bad({ strategy: "delay", anchor: { type: "effect", kind: "a", occurrence: 1 }, delayMs: 0 }),
		).toContain("delayMs");
		expect(
			bad({ strategy: "crash", anchor: { type: "write", index: 2 }, point: "before" }),
		).toContain("point applies to effect anchors only");
	});
});
