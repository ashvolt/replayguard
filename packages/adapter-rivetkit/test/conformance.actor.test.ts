import { afterAll } from "vitest";
import {
	CONFORMANCE_CASES,
	runtimeConformanceSuite,
} from "../../adapter-workflows/test-support/conformance.js";
import { removeKeyStores } from "../../adapter-workflows/test-support/conformance-cases.mjs";
import * as fixture from "./fixtures/conformance.actor.mjs";
import { ACTOR_SKIP_REASON } from "./support/actor-env.js";

const byIndex = [
	fixture.case0,
	fixture.case1,
	fixture.case2,
	fixture.case3,
	fixture.case4,
	fixture.case5,
];

// Spec 012 T009: the actor runtime classifies the spike scenarios like the engine runtimes.
runtimeConformanceSuite(
	"rivetkitRuntime (workflow actors)",
	(c) => (byIndex[CONFORMANCE_CASES.indexOf(c)] as (typeof byIndex)[number])(),
	{ timeoutMs: 240_000, ...(ACTOR_SKIP_REASON ? { skip: ACTOR_SKIP_REASON } : {}) },
);

afterAll(() => removeKeyStores(process.pid));
