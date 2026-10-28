import type { Report } from "@replayguard/core";
import { describe, expect, it } from "vitest";
import { consoleReporter } from "../src/index.js";
import { renderConsole } from "../src/render.js";
import { checkoutReport } from "./support/report.js";

// biome-ignore lint/suspicious/noControlCharactersInRegex: matches ANSI escape sequences
const ANSI = /\x1b\[/;

describe("renderConsole (T012)", () => {
	it("matches the concise golden output", async () => {
		await expect(renderConsole(checkoutReport())).toMatchFileSnapshot("./golden/concise.txt");
	});

	it("matches the verbose golden output", async () => {
		await expect(renderConsole(checkoutReport(), { verbose: true })).toMatchFileSnapshot(
			"./golden/verbose.txt",
		);
	});

	it("matches the ASCII golden output", async () => {
		await expect(renderConsole(checkoutReport(), { ascii: true })).toMatchFileSnapshot(
			"./golden/ascii.txt",
		);
	});

	it("shows the duplicated row with outcome, FAIL and explanation", () => {
		const row = renderConsole(checkoutReport())
			.split("\n")
			.find((l) => l.includes("duplicated ") && l.startsWith("crash"));
		expect(row).toContain("payment.charge::o-1");
		expect(row).toContain("FAIL");
		expect(row).toContain("payment.charge applied 2× (expected 1).");
	});

	it("colors verdicts only when asked and never otherwise", () => {
		expect(renderConsole(checkoutReport())).not.toMatch(ANSI);
		expect(renderConsole(checkoutReport(), { verbose: true })).not.toMatch(ANSI);
		const colored = renderConsole(checkoutReport(), { color: true, verbose: true });
		expect(colored).toContain("\x1b[1m\x1b[31mFAIL\x1b[39m\x1b[22m");
		expect(colored).toContain("\x1b[33mWARN\x1b[39m");
		expect(colored).toContain("\x1b[32mPASS\x1b[39m");
		// biome-ignore lint/suspicious/noControlCharactersInRegex: strips ANSI escape sequences
		expect(colored.replace(/\x1b\[\d+m/g, "")).toBe(
			renderConsole(checkoutReport(), { verbose: true }),
		);
	});

	it("states when no fault cases ran and lists baseline anomalies", () => {
		const r = checkoutReport();
		const empty: Report = {
			...r,
			summary: {
				...r.summary,
				cases: 0,
				verdict: "pass",
				verdicts: { pass: 0, warn: 0, fail: 0 },
				outcomes: {
					...r.summary.outcomes,
					duplicated: 0,
					deduplicated: 0,
					"concurrent-duplicate": 0,
					"exactly-once": 0,
				},
				skippedCandidates: 0,
			},
			baselineAnomalies: ['baseline did not complete (state "failed")'],
			cases: [r.cases[0] as Report["cases"][number]],
		};
		expect(renderConsole(empty)).toBe(
			[
				"ReplayGuard: checkout (workflows, seed 1) - PASS",
				"0 fault cases: 0 fail, 0 warn, 0 pass",
				"",
				"No fault cases ran (baseline only).",
				'! baseline: baseline did not complete (state "failed")',
				"",
			].join("\n"),
		);
		expect(renderConsole(empty, { verbose: true })).toContain("baseline │ payment.charge::o-1");
	});

	it("is pure", () => {
		expect(renderConsole(checkoutReport(), { verbose: true })).toBe(
			renderConsole(checkoutReport(), { verbose: true }),
		);
	});
});

describe("consoleReporter", () => {
	it("writes the rendered report to the sink", async () => {
		let out = "";
		const reporter = consoleReporter({ verbose: true, color: false, write: (s) => (out += s) });
		expect(reporter.name).toBe("console");
		await reporter.render(checkoutReport());
		expect(out).toBe(renderConsole(checkoutReport(), { verbose: true }));
	});

	it("detects colors and ASCII from the environment", async () => {
		const saved = { ...process.env };
		try {
			process.env["FORCE_COLOR"] = "1";
			process.env["TERM"] = "dumb";
			delete process.env["NO_COLOR"];
			let out = "";
			await consoleReporter({ write: (s) => (out += s) }).render(checkoutReport());
			expect(out).toMatch(ANSI);
			expect(out).toContain(" | ");
		} finally {
			process.env = saved;
		}
	});

	it("writes to stdout by default", async () => {
		const original = process.stdout.write.bind(process.stdout);
		let out = "";
		process.stdout.write = ((s: string) => {
			out += s;
			return true;
		}) as typeof process.stdout.write;
		try {
			await consoleReporter({ color: false }).render(checkoutReport());
		} finally {
			process.stdout.write = original;
		}
		expect(out).toContain("ReplayGuard: checkout");
	});
});
