import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type ImportTarget, runImport, TransientError } from "../src/import/importer.ts";
import { ImportState } from "../src/import/state.ts";
import type { BacklogItem } from "../src/model.ts";
import { demoItems } from "./fixtures.ts";

function fakeTarget(failures: Record<string, (Error | null)[]> = {}) {
	const created: [string, string | null][] = [];
	let n = 0;
	const target: ImportTarget = {
		name: "fake",
		async create(item: BacklogItem, parentKey: string | null) {
			const script = failures[item.sourceId];
			const next = script?.shift();
			if (next) throw next;
			created.push([item.sourceId, parentKey]);
			return `K-${++n}`;
		},
	};
	return { target, created };
}

const statePath = () => join(mkdtempSync(join(tmpdir(), "rg-state-")), "fake.json");

describe("runImport (template method)", () => {
	it("dry run plans everything and creates nothing", async () => {
		const { target, created } = fakeTarget();
		const log: string[] = [];
		const res = await runImport(demoItems(), target, {
			apply: false,
			includeDone: true,
			state: ImportState.load(statePath()),
			log: (l) => log.push(l),
		});
		expect(created).toEqual([]);
		expect(res).toEqual({ planned: 34, created: 0, skipped: 0 });
		expect(log[0]).toBe('would create Epic 004-demo "004 Demo Feature"');
		expect(log[1]).toBe('would create Story 004-demo-US1 "US1: First, with comma" under 004-demo');
	});

	it("applies parent-first, persists state after each create and is idempotent", async () => {
		const path = statePath();
		const { target, created } = fakeTarget();
		const opts = { apply: true, includeDone: true, log: () => undefined };
		const first = await runImport(demoItems(), target, { ...opts, state: ImportState.load(path) });
		expect(first.created).toBe(34);
		expect(created[0]).toEqual(["004-demo", null]);
		expect(created[1]).toEqual(["004-demo-US1", "K-1"]);
		const sub = created.find(([id]) => id === "004-demo-T005");
		expect(sub?.[1]).toBe("K-2");
		expect(JSON.parse(readFileSync(path, "utf8")).created["004-demo-T005"]).toBeDefined();
		const second = await runImport(demoItems(), target, { ...opts, state: ImportState.load(path) });
		expect(second).toEqual({ planned: 0, created: 0, skipped: 34 });
	});

	it("skips done items unless they have open descendants", async () => {
		const { target, created } = fakeTarget();
		await runImport(demoItems(), target, {
			apply: true,
			includeDone: false,
			state: ImportState.load(statePath()),
			log: () => undefined,
		});
		const ids = created.map(([id]) => id);
		expect(ids).not.toContain("004-demo-T002");
		expect(ids).toContain("004-demo");
		expect(ids).toHaveLength(33);
	});

	it("retries transient errors with backoff and stops on permanent ones", async () => {
		const sleeps: number[] = [];
		const { target } = fakeTarget({
			"004-demo": [new TransientError("429"), new TransientError("503"), null],
		});
		const res = await runImport(demoItems().slice(0, 1), target, {
			apply: true,
			includeDone: true,
			state: ImportState.load(statePath()),
			log: () => undefined,
			sleep: async (ms) => {
				sleeps.push(ms);
			},
		});
		expect(res.created).toBe(1);
		expect(sleeps).toEqual([500, 1000]);

		const failing = fakeTarget({ "004-demo": [new Error("400 bad request")] });
		await expect(
			runImport(demoItems(), failing.target, {
				apply: true,
				includeDone: true,
				state: ImportState.load(statePath()),
				log: () => undefined,
			}),
		).rejects.toThrow("400 bad request");
	});

	it("gives up after the maximum number of retries", async () => {
		const always = Array.from({ length: 10 }, () => new TransientError("503"));
		const { target } = fakeTarget({ "004-demo": always });
		await expect(
			runImport(demoItems().slice(0, 1), target, {
				apply: true,
				includeDone: true,
				state: ImportState.load(statePath()),
				log: () => undefined,
				sleep: async () => undefined,
			}),
		).rejects.toThrow("503");
	});

	it("uses existing keys reported by the target", async () => {
		const { target, created } = fakeTarget();
		target.existing = async () => new Map([["004-demo", "EXISTING-1"]]);
		await runImport(demoItems().slice(0, 2), target, {
			apply: true,
			includeDone: true,
			state: ImportState.load(statePath()),
			log: () => undefined,
		});
		expect(created).toEqual([["004-demo-US1", "EXISTING-1"]]);
	});
});
