import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkCommitMessage, main } from "../src/commit-msg.ts";

describe("checkCommitMessage", () => {
	it.each([
		"feat: add ledger",
		"fix(core)!: handle crash before flush",
		"docs(specs): add plan for 004-effect-ledger",
		"chore(deps): bump vitest",
		'Revert "feat: add ledger"',
		"Merge branch 'main' into feature",
	])("accepts %s", (msg) => {
		expect(checkCommitMessage(`${msg}\n\nbody`)).toBeNull();
	});

	it.each([
		["update stuff", "subject must follow Conventional Commits"],
		["feat:missing space", "subject must follow Conventional Commits"],
		["Feat: capital type", "subject must follow Conventional Commits"],
		[`feat: ${"x".repeat(100)}`, "subject must be at most 100 characters"],
		["", "commit message is empty"],
	])("rejects %s", (msg, reason) => {
		expect(checkCommitMessage(msg)).toContain(reason);
	});

	it("ignores comment lines git adds", () => {
		expect(checkCommitMessage("# Please enter a message\nfeat: x\n# comment")).toBeNull();
	});

	it("main reads the message file and returns an exit code", () => {
		const dir = mkdtempSync(join(tmpdir(), "rg-msg-"));
		const good = join(dir, "good");
		const bad = join(dir, "bad");
		writeFileSync(good, "feat: ok\n");
		writeFileSync(bad, "nope\n");
		const errors: string[] = [];
		expect(main([good], (s) => errors.push(s))).toBe(0);
		expect(main([bad], (s) => errors.push(s))).toBe(1);
		expect(main([], (s) => errors.push(s))).toBe(2);
		expect(errors.join("")).toContain("subject must follow Conventional Commits");
	});
});
