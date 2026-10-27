# Feature Specification: Reports (Structured, Console, HTML Timeline)

**Feature Branch**: `009-reporters`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Report whether an action was repeated, skipped, or safely deduplicated as: a typed structured object for assertions, a console table for humans, and a self-contained HTML report with a visual timeline of attempts, crashes and effects."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structured report object (Priority: P1)

A developer receives a typed, serializable report from a scenario and asserts on it or stores it
as a CI artifact.

**Why this priority**: All other reporters and matchers consume this model.

**Independent Test**: Run a scenario, serialize the report to JSON and parse it back without loss.

**Acceptance Scenarios**:

1. **Given** a classified scenario result, **When** the report is built, **Then** it contains a
   summary (cases, outcomes by class, verdict), per-case sections and per-effect outcomes with
   evidence and explanations.
2. **Given** a report, **When** serialized to JSON and parsed, **Then** the result deep-equals the
   original data and includes a schema version.

---

### User Story 2 - Console table (Priority: P1)

A developer running tests locally sees a compact table per scenario: one row per case × effect
with outcome and verdict, plus a summary line.

**Why this priority**: Immediate human feedback in terminals and CI logs.

**Independent Test**: Render a report with one duplicated effect; output contains the case name,
effect kind, `duplicated`, `FAIL`, and the explanation.

**Acceptance Scenarios**:

1. **Given** a report, **When** rendered to the console, **Then** each row shows case, fault,
   effect, attempts (applied/dedup), outcome and verdict, and failing rows include the explanation.
2. **Given** a terminal without color support or `NO_COLOR` set, **When** rendered, **Then** no
   ANSI codes are emitted.
3. **Given** a large report (100+ cases), **When** rendered with default verbosity, **Then** only
   non-passing rows and the summary are shown; full output is available with verbose mode.

---

### User Story 3 - HTML timeline report (Priority: P2)

A developer opens a single HTML file showing, per case, a timeline: runs/restarts as lanes,
effect attempts as bars (applied, deduplicated, failed, in-flight), and fault markers, with
outcome badges and explanations.

**Why this priority**: Best way to understand concurrency and timing bugs; slower to build.

**Independent Test**: Generate the report for the H3 scenario; the timeline shows two overlapping
payment bars and the timeout marker.

**Acceptance Scenarios**:

1. **Given** a report, **When** the HTML is generated, **Then** it is one file with no external
   resource references and opens offline in modern browsers.
2. **Given** effect subjects containing `<script>` text, **When** rendered, **Then** the text is
   displayed literally and never executed.
3. **Given** a case with a crash fault, **When** viewed, **Then** the timeline shows the fault
   marker, the run boundary, and attempts before and after the restart.
4. **Given** many cases, **When** viewed, **Then** the user can filter by verdict and outcome
   class without network access.

### Edge Cases

- Empty scenario (baseline only) → report states no fault cases ran.
- Attempts with zero duration → drawn with a minimum visible width.
- Extremely long effect subjects → truncated in tables with full text available on hover/details.
- Report from a newer schema version given to an older renderer → renderer refuses with a clear
  version error.
- Dark mode → HTML respects the user's color-scheme preference.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST build a versioned, serializable report model from classified results.
- **FR-002**: Reporters MUST consume the report model through a common traversal interface so new
  formats need no model changes.
- **FR-003**: The console reporter MUST render a table with summary, honor `NO_COLOR` and support
  concise/verbose modes.
- **FR-004**: The HTML reporter MUST produce a single self-contained file with an inline timeline
  visualization, filters, outcome legend and explanations.
- **FR-005**: The HTML reporter MUST escape all data, include a restrictive content security
  policy, and contain no external references.
- **FR-006**: Reporters MUST be pure: given the same report they produce identical output.
- **FR-007**: The report MUST be writable to a user-specified path; the library MUST NOT write
  files unless asked.
- **FR-008**: The HTML MUST be readable in light and dark color schemes and on narrow screens.
- **FR-009**: Outcome classes MUST be distinguishable without color (text labels and patterns),
  and filters/details MUST be operable by keyboard.

### Key Entities

- **Report**: schema version, scenario metadata, summary, cases.
- **CaseReport**: fault, runs, workflow outcome, effect outcomes, timeline events.
- **TimelineEvent**: run start/end, attempt bar, fault marker, timeout marker.
- **Reporter**: consumer producing a string or structured output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer identifies the failing effect and its cause from the console output in
  under 30 seconds.
- **SC-002**: HTML report for 100 cases is under 1 MB and opens in under 2 seconds.
- **SC-003**: Zero script execution from report data (verified by injection tests).
- **SC-004**: JSON round-trip is lossless for 100% of reports.

## Assumptions

- Modern evergreen browsers for the HTML report.
- CI systems capture stdout and can store files as artifacts.
