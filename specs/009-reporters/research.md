# Research: Reporters

## R1 — Timeline rendering

- **Decision**: Server-side inline SVG per case: x = time (relative to case start), lanes = runs;
  attempt bars colored + patterned by status (applied solid, deduplicated striped, failed
  outlined, in-flight-at-end hatched), fault markers as vertical lines with labels, run boundaries
  as lane separators. Outcome badges carry text labels (FR-009).
- **Rationale**: Works without JavaScript; accessible via `<title>` elements; no chart library.

## R2 — Interactivity

- **Decision**: ≤ 2 KB inline script toggling `hidden` on case sections by verdict/outcome filter
  (`<select>` elements, keyboard operable); `<details>` for explanations.

## R3 — CSP

- **Decision**: `<meta http-equiv="Content-Security-Policy" content="default-src 'none';
  style-src 'sha256-…'; script-src 'sha256-…'; img-src data:; base-uri 'none'; form-action
  'none'">`; hashes computed with `crypto.subtle.digest` at render time, so `renderHtml` is async.

## R4 — Data embedding

- **Decision**: Report JSON embedded in `<script type="application/json" id="rg-data">` with
  `<`, `>`, `&`, U+2028/2029 escaped as `\uXXXX`; read by the filter script via `JSON.parse`.

## R5 — Console tables

- **Decision**: Hand-written column layout (widths from content, max 40 per column, `…`
  truncation), box-drawing optional (`ascii` fallback when `TERM=dumb`), colors via ANSI
  sequences only when `stream.isTTY && !NO_COLOR` or `FORCE_COLOR`.

## R6 — Schema versioning

- **Decision**: `report.version = 1`; `parseReport` rejects other versions with
  `SchemaError` (`RG_SCHEMA_VERSION`).
