import type { Report, Reporter } from "@replayguard/core";
import { shouldUseColor, useAscii } from "./color.js";
import { type ConsoleOptions, renderConsole } from "./render.js";

export { type Palette, palette, shouldUseColor, useAscii } from "./color.js";
export { type ConsoleOptions, renderConsole } from "./render.js";
export { renderTable, type TableOptions, truncate } from "./table.js";

/** Options for the console reporter. */
export interface ConsoleReporterOptions {
	/** Verbose output. */
	verbose?: boolean;
	/** Force colors on or off (default: `NO_COLOR`/`FORCE_COLOR`/TTY detection). */
	color?: boolean;
	/** Output sink (default `process.stdout.write`). */
	write?: (text: string) => void;
}

/**
 * A reporter that prints the report table to stdout (or `write`).
 *
 * @example
 * await consoleReporter({ verbose: true }).render(report);
 */
export function consoleReporter(options: ConsoleReporterOptions = {}): Reporter<void> {
	return {
		name: "console",
		render(report: Report) {
			const write = options.write ?? ((text: string) => void process.stdout.write(text));
			const renderOptions: ConsoleOptions = {
				color: options.color ?? shouldUseColor(process.env, process.stdout.isTTY),
				ascii: useAscii(process.env),
				...(options.verbose === undefined ? {} : { verbose: options.verbose }),
			};
			write(renderConsole(report, renderOptions));
		},
	};
}
