import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import * as fixture from "./fixtures/conformance.actor.mjs";
import { ACTOR_SKIP_REASON } from "./support/actor-env.js";

const actorDirs = () => readdirSync(tmpdir()).filter((n) => n.startsWith("replayguard-actor-"));
const alive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

// Spec 012 T005/T013: hosts start on a free port block with temp storage and leave nothing behind.
describe.skipIf(ACTOR_SKIP_REASON !== undefined)("actor host lifecycle and leaks", () => {
	it("runs a baseline and leaves no engine process or storage directory", async () => {
		const before = new Set(actorDirs());
		let enginePid: number | undefined;
		const { readEnginePid } = await import("../src/engine.js");
		const watcher = setInterval(() => {
			for (const dir of actorDirs()) {
				if (!before.has(dir)) enginePid ??= readEnginePid(`${tmpdir()}/${dir}`);
			}
		}, 50);
		try {
			const result = await fixture.baselineOnly().run();
			expect(result.baseline).toMatchObject({
				status: "settled",
				final: { state: "completed", output: "done" },
			});
		} finally {
			clearInterval(watcher);
		}
		expect(enginePid).toBeTypeOf("number");
		await new Promise((r) => setTimeout(r, 500));
		expect(alive(enginePid as number)).toBe(false);
		expect(actorDirs().filter((d) => !before.has(d))).toEqual([]);
	}, 240_000);
});
