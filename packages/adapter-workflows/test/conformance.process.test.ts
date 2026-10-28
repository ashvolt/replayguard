import { afterAll } from "vitest";
import { CONFORMANCE_CASES, runtimeConformanceSuite } from "../test-support/conformance.js";
import { removeKeyStores } from "../test-support/conformance-cases.mjs";
import * as fixture from "./fixtures/conformance.scenario.mjs";

// Each case's scenario lives in a module the child process can load (plain JS, built package).
const byIndex = [
	fixture.case0,
	fixture.case1,
	fixture.case2,
	fixture.case3,
	fixture.case4,
	fixture.case5,
];

runtimeConformanceSuite(
	"workflowsProcessRuntime (child process + FileDriver)",
	(c) => (byIndex[CONFORMANCE_CASES.indexOf(c)] as (typeof byIndex)[number])(),
	{ timeoutMs: 60_000 },
);

afterAll(() => removeKeyStores(process.pid));
