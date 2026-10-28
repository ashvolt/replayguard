import { classify } from "../../src/classifier/classify.js";
import type { ClassifiedResult } from "../../src/classifier/types.js";
import { fault } from "../../src/faults/types.js";
import type { CaseResult } from "../../src/scenario/result.js";
import { caseResult, scenarioResult } from "../classifier/arbitraries.js";

/** Baseline + one duplicated crash case + one deduplicated case; case 1 starts at t=100. */
export function checkoutClassified(): ClassifiedResult {
	const raw = caseResult(
		1,
		[
			{ start: 100, end: 110, run: 0 },
			{ start: 130, end: 135, run: 1 },
		],
		{
			name: "crash after payment",
			faults: [{ strategy: "crash", anchor: "after payment#1", at: 112, runIndex: 0 }],
			restarts: 1,
		},
	);
	const crashed: CaseResult = {
		...raw,
		faults: [fault.crashAfter("payment")],
		ledger: {
			...raw.ledger,
			runs: [
				{ runIndex: 0, startedAt: 100, endedAt: 112, endReason: "crashed", dead: true },
				{ runIndex: 1, startedAt: 120, endedAt: 140, endReason: "completed", dead: false },
			],
		},
	};
	const dedup = caseResult(
		2,
		[
			{ start: 200, end: 201, key: "k" },
			{ start: 210, end: 211, key: "k", status: "deduplicated" },
		],
		{ name: "lost response" },
	);
	const result = scenarioResult(caseResult(0, [{ start: 0, end: 1 }]), [crashed, dedup]);
	return classify({ ...result, skipped: [{ name: "skipped-1", faults: [] }] });
}
