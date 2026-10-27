# Feature Specification: Upstream Proposal to Rivet

**Feature Branch**: `013-upstream-proposal`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "If the prototype reveals a genuine gap, propose a focused contribution. Scope: GitHub issues with minimal reproductions and a design proposal; a PR only after maintainers respond."

## Clarifications

### Session 2026-10-28

- Q: Upstream scope? → A: Issues + minimal repro + design proposal; no PR until maintainers
  respond.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Minimal reproductions (Priority: P1)

A Rivet maintainer receives a repository-independent, runnable reproduction for each gap that
uses only the engine's public API and shows the behavior in under a minute.

**Why this priority**: Without a crisp repro, issues are ignored.

**Independent Test**: A fresh clone runs `npm test` in each repro folder and sees the failing
expectation.

**Acceptance Scenarios**:

1. **Given** the crash-loop repro (H2), **When** run, **Then** it shows a step executing more than
   `maxRetries + 1` times without `StepExhaustedError`.
2. **Given** the timeout repro (H3), **When** run, **Then** it shows a timed-out step's operation
   completing after the timeout while the retry also completes.
3. **Given** each repro, **When** inspected, **Then** it depends only on the published engine
   package and a test runner.

---

### User Story 2 - Issue drafts with design proposals (Priority: P1)

The maintainer of ReplayGuard files well-structured issues: observed vs expected behavior, impact,
repro link, and options for a fix with trade-offs.

**Why this priority**: Converts findings into actionable upstream work.

**Independent Test**: Drafts reviewed against the repository's contribution guidelines.

**Acceptance Scenarios**:

1. **Given** H2, **When** drafted, **Then** the proposal covers: persisting attempt metadata before
   running the step vs a "started" marker, cost of the extra write, and interaction with ephemeral
   steps.
2. **Given** H3, **When** drafted, **Then** the proposal covers passing an abort signal to step
   callbacks on timeout and documenting the background-continuation behavior.
3. **Given** the missing stable step identity, **When** drafted, **Then** the proposal covers
   exposing a stable step key to step callbacks for idempotency.

---

### User Story 3 - Track responses (Priority: P3)

The maintainer tracks filed issues and decides on PRs after responses.

**Why this priority**: Process hygiene.

**Independent Test**: The tracking document lists each issue with link, status and decision.

**Acceptance Scenarios**:

1. **Given** filed issues, **When** maintainers respond, **Then** the tracking document records the
   decision and next action.

### Edge Cases

- Upstream already fixed a gap in a newer version → repro re-run against latest; issue not filed;
  ReplayGuard docs updated.
- Maintainers consider behavior intended → document as a known semantic in ReplayGuard docs and
  keep detection.
- Filing issues is an outward-facing action → requires explicit maintainer (user) approval before
  submission.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Provide standalone reproductions for H2 (crash loop bypasses retries), H3 (timeout
  continues in background) and the missing stable step identity.
- **FR-002**: Each reproduction MUST run against the latest published engine version at drafting
  time and record the version.
- **FR-003**: Provide issue drafts with observed/expected behavior, impact, repro and design
  options.
- **FR-004**: Issues MUST NOT be filed without explicit approval from the ReplayGuard maintainer.
- **FR-005**: Maintain a tracking document of filed issues and decisions.

### Key Entities

- **Reproduction**: folder with package manifest, test, README.
- **IssueDraft**: title, body, labels, linked repro.
- **UpstreamTracker**: list of issues with status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each reproduction runs green-to-red (shows the gap) in under 60 seconds from a fresh
  clone.
- **SC-002**: All drafts approved by the ReplayGuard maintainer before filing.

## Assumptions

- Rivet accepts issues on `rivet-dev/rivet` or `rivet-dev/workflows`; the target repo is chosen at
  filing time based on where the engine source lives.
