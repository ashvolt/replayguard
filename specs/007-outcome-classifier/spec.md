# Feature Specification: Outcome Classifier & Verdict Policy

**Feature Branch**: `007-outcome-classifier`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Report whether each action was repeated, skipped, or safely deduplicated. Spike F0 added orphaned (charged but workflow failed/unrecorded) and concurrent-duplicate (overlapping in-flight calls after timeout). Strict default verdicts with per-effect overrides."

## Clarifications

### Session 2026-10-28

- Q: Default verdict policy? → A: Strict. Fail on `duplicated`, `concurrent-duplicate`,
  `orphaned`, `skipped`; pass `exactly-once` and `deduplicated`. Per-effect overrides allowed
  (e.g. duplicate emails acceptable).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Classify every effect in every case (Priority: P1)

After a scenario runs, a developer gets, for each logical effect in each case, exactly one outcome
from a fixed taxonomy, plus the evidence (attempts, timings, fault) behind it.

**Why this priority**: The classification is the product's answer to "was it repeated, skipped,
or deduplicated?".

**Independent Test**: Feed hand-built ledger snapshots for each spike hypothesis to the classifier
and check the outcomes.

**Acceptance Scenarios**:

1. **Given** a logical effect applied once in a case where the workflow completed, **When**
   classified, **Then** the outcome is `exactly-once`.
2. **Given** two non-overlapping applied attempts without dedup (spike H1), **When** classified,
   **Then** the outcome is `duplicated` with count 2.
3. **Given** two attempts where the second was deduplicated by the provider (H1b), **When**
   classified, **Then** the outcome is `deduplicated`.
4. **Given** two applied attempts whose in-flight intervals overlap (H3a), **When** classified,
   **Then** the outcome is `concurrent-duplicate`.
5. **Given** an applied attempt and a final workflow state of failed (H3b), **When** classified,
   **Then** the outcome is `orphaned`.
6. **Given** an effect present in the baseline but with zero applied attempts in a case whose
   workflow completed, **When** classified, **Then** the outcome is `skipped`.

---

### User Story 2 - Pass/fail verdicts with a strict default (Priority: P1)

A developer wants a single pass/fail answer per case and per scenario using the strict policy,
without writing rules.

**Why this priority**: Makes results actionable in CI.

**Independent Test**: A scenario with one duplicated effect yields verdict `fail` with that effect
listed as the reason.

**Acceptance Scenarios**:

1. **Given** default policy and any `duplicated`, `concurrent-duplicate`, `orphaned` or `skipped`
   outcome, **When** verdicts are computed, **Then** the case and scenario fail and list each
   violating effect.
2. **Given** only `exactly-once` and `deduplicated` outcomes, **When** computed, **Then** the
   scenario passes.

---

### User Story 3 - Override the policy per effect (Priority: P2)

A developer accepts duplicate "order shipped" emails but never duplicate payments.

**Why this priority**: Real systems tolerate some duplicates; avoids false failures.

**Independent Test**: Policy `{ email: { allow: ["duplicated"] } }` turns an email duplication
into a pass while payment duplication still fails.

**Acceptance Scenarios**:

1. **Given** an override allowing `duplicated` for kind `email`, **When** an email is duplicated,
   **Then** the verdict is `pass` with the outcome still reported as `duplicated`.
2. **Given** an override marking `orphaned` as `warn` for kind `audit-log`, **When** orphaned,
   **Then** the verdict is `warn` and the scenario does not fail.

---

### User Story 4 - Explain why (Priority: P2)

For each non-passing outcome the developer sees a short causal explanation tied to the fault
(e.g. "applied, then process crashed before the step result was saved; restart re-ran the step").

**Why this priority**: Turns a red test into an understood bug.

**Independent Test**: A duplicated outcome from a crash fault includes an explanation referencing
the crash time and the restart.

**Acceptance Scenarios**:

1. **Given** a duplicated outcome caused by a crash, **When** explained, **Then** the explanation
   names the fault, the applied attempt before it, and the re-execution after restart.

### Edge Cases

- Attempt still in flight at finalization (never completed) → `unknown` sub-status; classified
  `orphaned` only if the provider later applied it, otherwise reported as `in-flight-at-end`
  warning.
- Failed attempts (provider rejected) do not count as applied.
- Mixed: one dedup + two applied → `duplicated` (worst outcome wins; severity order:
  concurrent-duplicate > duplicated > orphaned > skipped > deduplicated > exactly-once).
- Effect that legitimately happens N times in baseline (e.g. loop sending 3 emails to different
  subjects) → distinct logical identities; same subject N times in baseline sets expected count N.
- Workflow ended `budget-exceeded` or `waiting` → effects classified with workflow state
  "unsettled"; applied effects are not `orphaned` unless the workflow reached a failed state.
- Baseline itself shows duplicates → reported as baseline anomaly; cases still classified
  relative to expected counts from baseline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The classifier MUST assign exactly one outcome per logical effect per case from:
  `exactly-once`, `duplicated`, `deduplicated`, `concurrent-duplicate`, `orphaned`, `skipped`.
- **FR-002**: Expected count per logical effect MUST be derived from the baseline case.
- **FR-003**: Outcome rules MUST be independent, composable predicates evaluated in a documented
  severity order.
- **FR-004**: The default policy MUST fail on `duplicated`, `concurrent-duplicate`, `orphaned`,
  `skipped` and pass `exactly-once`, `deduplicated`.
- **FR-005**: Policies MUST support per-effect-kind and per-logical-identity overrides mapping
  outcomes to `pass`, `warn` or `fail`.
- **FR-006**: Verdicts MUST be computed per effect, per case and per scenario (worst wins).
- **FR-007**: Each classification MUST include evidence: attempt IDs, applied/dedup counts,
  overlap intervals, triggering fault, workflow final state.
- **FR-008**: Each non-exactly-once outcome MUST include a human-readable explanation.
- **FR-009**: The classifier MUST be a pure function of ledger snapshots, case metadata and policy.
- **FR-010**: Property-based tests MUST prove invariants: no effect applied >1 time without dedup
  is ever `exactly-once`/`deduplicated`; every logical effect gets exactly one outcome.

### Key Entities

- **Outcome**: enumerated classification with evidence and explanation.
- **ExpectedEffect**: logical identity + expected applied count from baseline.
- **Policy**: default rules + overrides.
- **Verdict**: pass/warn/fail with reasons, at effect, case and scenario level.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All spike F0 hypotheses classify to the expected outcome with 100% agreement.
- **SC-002**: Zero false `exactly-once` verdicts across 10,000 generated property-test cases.
- **SC-003**: Classification of a 100-case scenario takes under 100 ms.
- **SC-004**: 90% of test users can name the cause of a failing case from the explanation alone
  (validated in dogfooding review).

## Assumptions

- Attempt intervals use the ledger's monotonic time; overlap means interval intersection with
  non-zero length.
- Expected counts assume the baseline is representative (deterministic workflow per constitution).
