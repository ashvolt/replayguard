# Research: Diagrams-as-Code

## R1 — Excalidraw scene format

- **Decision**: Emit Excalidraw scene JSON v2 (`{type:"excalidraw", version:2, source, elements,
  appState, files}`) with `rectangle`/`ellipse`/`diamond` containers, bound `text` elements
  (`containerId`) and `arrow` elements with `startBinding`/`endBinding`; containers list their
  bound text and arrows in `boundElements`.
- **Rationale**: Bound text and arrows stay attached when users move shapes in Excalidraw.
- **Alternatives**: Mermaid → Excalidraw conversion (`@excalidraw/mermaid-to-excalidraw`) needs a
  DOM; rejected for CLI determinism and dependency weight.

## R2 — SVG rendering

- **Decision**: Render SVG directly from the same laid-out geometry (clean style, not rough.js).
- **Rationale**: Excalidraw's own `exportToSvg` requires a browser/DOM; a direct renderer is
  deterministic, dependency-free and good enough for previews on GitHub.
- **Alternatives**: Headless browser export — slow, flaky in CI, heavy.

## R3 — Flow layout algorithm

- **Decision**: Simplified Sugiyama: (1) break cycles by DFS in declaration order, reversing back
  edges; (2) rank = longest path from sources; (3) order nodes within rank by declaration order then
  barycenter of predecessors (one sweep); (4) assign coordinates on a grid with rank spacing;
  (5) groups drawn as frames around member bounding boxes.
- **Rationale**: Deterministic, small (~150 LOC), adequate for ≤ 40 nodes.
- **Alternatives**: dagre/elkjs — larger deps, ELK async/worker; unnecessary at this scale.

## R4 — Sequence layout

- **Decision**: Actors spaced evenly on x; each message on its own y row in declared order;
  self-messages drawn as a loop; dashed style for replies.

## R5 — Text measurement

- **Decision**: Approximate width = chars × 0.6 × fontSize (Virgil/Helvetica average), wrap at
  max 220 px; height = lines × fontSize × 1.25. Excalidraw re-measures on open (autoResize).

## R6 — Task ID extraction

- **Decision**: Task IDs come from checklist lines matching
  `^- \[[ xX]\] (T\d{3,})\b` in `tasks.md`; diagram IDs from `tasks` arrays in YAML.
- **Rationale**: Same strict format Spec Kit mandates; shared with tool 002.

## R7 — Freshness check

- **Decision**: `check` regenerates in memory and byte-compares with files on disk (LF only).
- **Alternatives**: Hash files in a lockfile — extra artifact to keep in sync.

## R8 — Running TypeScript tooling

- **Decision**: Node native type stripping (`node --experimental-strip-types`, unflagged from
  22.18); imports use `.ts` extensions; `erasableSyntaxOnly` in tsconfig.
- **Note**: Local Node is 22.14 → the flag is passed explicitly in scripts; it is a no-op on
  newer versions.
