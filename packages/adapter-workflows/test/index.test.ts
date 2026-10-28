import { expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index.js";

it("exposes its package name", () => {
	expect(PACKAGE_NAME).toBe("@replayguard/adapter-workflows");
});
