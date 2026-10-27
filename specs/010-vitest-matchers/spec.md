# Feature Specification: Vitest Matchers

**Feature Branch**: `010-vitest-matchers`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Custom vitest matchers, e.g. expect(report).toHaveNoDuplicateEffects(), so side-effect safety becomes a normal assertion in a test suite."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assert the policy passes (Priority: P1)

A developer writes `expect(result).toPassSideEffectPolicy()` and gets a failing test with a
readable diff of violating effects when any case violates the policy.

**Why this priority**: One assertion covers the strict default; the main integration point.

**Independent Test**: A scenario with a duplicate charge fails the matcher with a message listing
case, effect, outcome and explanation.

**Acceptance Scenarios**:

1. **Given** a passing scenario, **When** asserting `toPassSideEffectPolicy()`, **Then** the test
   passes.
2. **Given** a failing scenario, **When** asserting, **Then** the failure message lists each
   violation with case name, effect kind/subject, outcome and explanation.
3. **Given** `.not.toPassSideEffectPolicy()` on a failing scenario, **When** asserting, **Then** it
   passes.

---

### User Story 2 - Targeted matchers (Priority: P1)

A developer asserts specific properties: no duplicates at all, a given effect kind is
exactly-once or deduplicated, or no orphaned effects.

**Why this priority**: Expressive tests for specific guarantees.

**Independent Test**: `toHaveNoDuplicateEffects()` fails on `duplicated` or `concurrent-duplicate`
only; `toBeEffectivelyOnce('payment')` passes on `deduplicated`.

**Acceptance Scenarios**:

1. **Given** a report with a deduplicated payment, **When** asserting
   `toBeEffectivelyOnce('payment')`, **Then** it passes.
2. **Given** a report with an orphaned payment, **When** asserting `toHaveNoOrphanedEffects()`,
   **Then** it fails naming the case.
3. **Given** a report, **When** asserting `toHaveOutcome('email', 'duplicated')`, **Then** it passes
   only if at least one case classified email as duplicated.

---

### User Story 3 - Type-safe setup (Priority: P2)

A developer registers matchers once in a setup file and gets editor autocompletion and type
checking for matcher names and arguments.

**Why this priority**: Developer experience.

**Independent Test**: A type test fails to compile when a matcher receives an invalid outcome name.

**Acceptance Scenarios**:

1. **Given** the setup import, **When** writing `expect(r).toHaveOutcome('email', 'dupe')`,
   **Then** the type checker reports an error.

### Edge Cases

- Matcher receives something that is not a scenario result/report → fails with a clear message
  about the expected type.
- Matchers used with the HTML/console reporter disabled → unaffected.
- Very long violation lists → message shows first 20 with a count of the rest.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The package MUST provide matchers: `toPassSideEffectPolicy(policy?)`,
  `toHaveNoDuplicateEffects()`, `toHaveNoOrphanedEffects()`, `toBeEffectivelyOnce(selector)`,
  `toHaveOutcome(selector, outcome)`.
- **FR-002**: Matchers MUST accept scenario results and reports.
- **FR-003**: Failure messages MUST list violations with case, effect, outcome, explanation, and
  support negation.
- **FR-004**: The package MUST ship TypeScript declarations augmenting the test framework's
  assertion types.
- **FR-005**: Registration MUST be possible via a single setup import.
- **FR-006**: Matchers MUST not depend on reporters.

### Key Entities

- **Matcher**: assertion over a report with pass flag and message.
- **EffectSelector**: effect kind string or predicate over logical effects.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding side-effect assertions to an existing test requires 2 lines (setup import +
  expect).
- **SC-002**: 100% of matcher failure messages name the case and the effect.

## Assumptions

- Vitest is the supported test framework for matchers in v1 (current major and previous major);
  the core runner remains framework agnostic.
