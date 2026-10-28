# Reports and reporters

A classified result becomes a versioned, serializable **report**. Reporters turn that report into
console tables or a self-contained HTML page.

```ts
import { buildReport, classify } from "@replayguard/core";
import { renderConsole } from "@replayguard/reporter-console";
import { writeHtmlReport } from "@replayguard/reporter-html";

const report = buildReport(classify(await checkout.run()));
console.log(renderConsole(report));
await writeHtmlReport(report, "reports/checkout.html");
```

## The report model (`version: 1`)

`buildReport(classified, { clock? })` returns plain data:

- **`summary`**: counts over the *fault* cases (the baseline is the reference). It contains
  `cases`, the overall `verdict`, `outcomes` per class, `verdicts` per level and
  `skippedCandidates`.
- **`cases`**: the baseline first, then every case. Each case has its human-readable `faults`,
  `status`, `finalState`, run counts, `verdict`, `effects` (with `explanation` and `hints`),
  `warnings` and a `timeline`.
- **`timeline`**: `run`, `attempt` and `fault` events, in milliseconds relative to the first run.

`reportToJson(report)` and `parseReport(json)` round-trip the report exactly. `parseReport`
validates the input and throws `SchemaError`:

| Code | Cause |
|---|---|
| `RG_SCHEMA_JSON` | The input is not JSON |
| `RG_SCHEMA_VERSION` | The report version is not one this release reads (currently 1) |
| `RG_SCHEMA_REPORT` | The report has a wrong field; the message names its path |

To write a new output format, implement `ReportVisitor` and call `walkReport(report, visitor)`.
The traversal order is report → each case → its effects → its timeline. Implement
`Reporter<T>` to plug the format in alongside the built-in ones.

## Console (`@replayguard/reporter-console`)

`renderConsole(report, { verbose?, color?, ascii? })` returns a string and is pure (same input,
same output). By default it shows only the fault cases:

```text
ReplayGuard: checkout (workflows, seed 1) - FAIL
4 fault cases: 2 fail, 1 warn, 1 pass | exactly-once 2, deduplicated 1, duplicated 1, concurrent-duplicate 1 | 2 candidate(s) not run (budget)

Case                │ Effect                            │ Outcome              │ Verdict │ Explanation
────────────────────┼───────────────────────────────────┼──────────────────────┼─────────┼─────────────────────────────────────────
crash after payment │ payment.charge::o-1               │ duplicated           │ FAIL    │ payment.charge applied 2× (expected 1).…
crash after payment │ email.send::a@example.com|receipt │ exactly-once         │ PASS    │ email.send applied once.
lost response       │ payment.charge::o-1               │ deduplicated         │ PASS    │ payment.charge was attempted 2× and the…
slow provider       │ payment.charge::o-1               │ concurrent-duplicate │ WARN    │ payment.charge applied 2× with overlapp…
broken harness      │ -                                 │ -                    │ FAIL    │ harness error: child process exited bef…
2 warning(s); run with verbose for explanations and hints
```

- Columns are at most 40 characters wide; longer text ends in `…`.
- `verbose: true` adds the baseline rows and a **Details** section. For every effect that does
  not pass, it shows the full explanation and each hint with its code example. It also lists
  every warning.
- `consoleReporter({ verbose?, color?, write? })` prints to stdout. When `color` is not set, it
  decides from the environment:
  - `NO_COLOR` (non-empty) disables color, and wins over everything else.
  - Otherwise `FORCE_COLOR` turns color on, unless it is `0` or `false`.
  - Otherwise color is used only on a TTY.
- `TERM=dumb` switches to ASCII separators.

## HTML (`@replayguard/reporter-html`)

`renderHtml(report, { title? })` produces one self-contained file. `writeHtmlReport(report, path)`
writes it and creates the parent directories. The library writes files only when asked.

The page contains:

- **Summary**, **legend** and **filters**. The filters are plain `<select>` elements, so they work
  with the keyboard, and a live region announces how many cases are shown.
- **One section per case**. Each section has an effect table, `<details>` with the explanation
  and hints, and an inline **SVG timeline**:
  - one lane per run;
  - attempt bars that are solid (applied), striped (deduplicated), outlined (failed) or hatched
    (still in flight);
  - dashed markers for injected faults;
  - a `<title>` on every element, for screen readers and hover.
- **Outcome badges** with text labels and border styles, so outcomes can be told apart without
  color.
- Light and dark color schemes, and horizontal scrolling for tables on narrow screens.

**Security.** All data is escaped through the `html` tagged template. The page has no external
references, no inline event handlers and no `style` attributes. A strict Content Security
Policy allows only the inline stylesheet and the filter script, by SHA-256 hash:

```text
default-src 'none'; style-src 'sha256-…'; script-src 'sha256-…'; img-src data:; base-uri 'none'; form-action 'none'
```

The report JSON is embedded in `<script type="application/json" id="rg-data">`, with `<`, `>`,
`&`, U+2028 and U+2029 escaped. A report of 100 cases stays under 1 MB.
