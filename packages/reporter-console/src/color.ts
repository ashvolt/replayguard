/** Text decorators. */
export interface Palette {
	/** Failures. */
	red(text: string): string;
	/** Passes. */
	green(text: string): string;
	/** Warnings. */
	yellow(text: string): string;
	/** Secondary text. */
	dim(text: string): string;
	/** Emphasis. */
	bold(text: string): string;
}

/**
 * Whether to emit ANSI colors: `NO_COLOR` (non-empty) wins, then `FORCE_COLOR` (unless `0` or
 * `false`), then whether the stream is a TTY.
 *
 * @example
 * shouldUseColor(process.env, process.stdout.isTTY);
 */
export function shouldUseColor(
	env: Readonly<Record<string, string | undefined>>,
	isTTY: boolean | undefined,
): boolean {
	if (env["NO_COLOR"]) return false;
	const force = env["FORCE_COLOR"];
	if (force !== undefined) return force !== "0" && force !== "false";
	return isTTY === true;
}

/**
 * Whether to avoid box-drawing characters (`TERM=dumb`).
 *
 * @example
 * useAscii(process.env);
 */
export function useAscii(env: Readonly<Record<string, string | undefined>>): boolean {
	return env["TERM"] === "dumb";
}

const wrap = (open: number, close: number) => (text: string) =>
	`\x1b[${open}m${text}\x1b[${close}m`;
const plain = (text: string) => text;

/**
 * ANSI decorators, or identity functions when disabled.
 *
 * @example
 * palette(true).red("FAIL");
 */
export function palette(enabled: boolean): Palette {
	return enabled
		? {
				red: wrap(31, 39),
				green: wrap(32, 39),
				yellow: wrap(33, 39),
				dim: wrap(2, 22),
				bold: wrap(1, 22),
			}
		: { red: plain, green: plain, yellow: plain, dim: plain, bold: plain };
}
