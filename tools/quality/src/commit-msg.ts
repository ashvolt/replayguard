import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TYPES = "feat|fix|docs|chore|refactor|test|perf|build|ci|style|revert";
const SUBJECT = new RegExp(`^(${TYPES})(\\([a-z0-9-]+(,[a-z0-9-]+)*\\))?!?: \\S.*$`);
const EXEMPT = /^(Merge |Revert ")/;
const MAX_SUBJECT = 100;

/**
 * Validates a commit message against Conventional Commits; returns null when valid,
 * otherwise a human-readable reason.
 *
 * @example
 * checkCommitMessage("feat(core): add ledger"); // null
 */
export function checkCommitMessage(message: string): string | null {
	const subject = message
		.split(/\r?\n/)
		.find((line) => !line.startsWith("#") && line.trim() !== "");
	if (subject === undefined) return "commit message is empty";
	if (EXEMPT.test(subject)) return null;
	if (subject.length > MAX_SUBJECT) return `subject must be at most ${MAX_SUBJECT} characters`;
	if (!SUBJECT.test(subject)) {
		return `subject must follow Conventional Commits: <${TYPES.split("|").join("|")}>(scope)?: description`;
	}
	return null;
}

export function main(argv: readonly string[], writeError: (text: string) => void): number {
	const file = argv[0];
	if (file === undefined) {
		writeError("usage: commit-msg <message-file>\n");
		return 2;
	}
	const reason = checkCommitMessage(readFileSync(file, "utf8"));
	if (reason === null) return 0;
	writeError(`✗ ${reason}\n`);
	return 1;
}

/* v8 ignore start -- entrypoint glue; main() is fully tested */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = main(process.argv.slice(2), (s) => process.stderr.write(s));
}
/* v8 ignore stop */
