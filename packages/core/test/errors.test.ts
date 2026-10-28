import { describe, expect, it } from "vitest";
import {
	BudgetExceededError,
	ConfigError,
	CrashSignal,
	HarnessError,
	ReplayGuardError,
	SchemaError,
	serializeError,
} from "../src/errors.js";

describe("errors", () => {
	it.each([
		[new ConfigError("bad"), "ConfigError", "RG_CONFIG"],
		[new ConfigError("bad", "RG_CONFIG_UNHASHABLE"), "ConfigError", "RG_CONFIG_UNHASHABLE"],
		[new CrashSignal("dead"), "CrashSignal", "RG_CRASH"],
		[new HarnessError("boom"), "HarnessError", "RG_HARNESS"],
		[new BudgetExceededError("slow"), "BudgetExceededError", "RG_BUDGET"],
		[new SchemaError("v2"), "SchemaError", "RG_SCHEMA"],
	])("%s has a stable name and code", (error, name, code) => {
		expect(error).toBeInstanceOf(ReplayGuardError);
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe(name);
		expect(error.code).toBe(code);
	});

	it("keeps the cause", () => {
		const cause = new Error("root");
		expect(new HarnessError("wrapped", { cause }).cause).toBe(cause);
	});

	it("serializes errors to plain data", () => {
		expect(serializeError(new ConfigError("bad", "RG_CONFIG_X"))).toEqual({
			name: "ConfigError",
			message: "bad",
			code: "RG_CONFIG_X",
		});
		expect(serializeError(new TypeError("t"))).toEqual({ name: "TypeError", message: "t" });
		expect(serializeError(Object.assign(new Error("e"), { code: 42 }))).toEqual({
			name: "Error",
			message: "e",
		});
		expect(serializeError("plain")).toEqual({ name: "NonError", message: "plain" });
		expect(serializeError(undefined)).toEqual({ name: "NonError", message: "undefined" });
	});
});
