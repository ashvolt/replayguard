# Feature Specification: Task Export to Issue Trackers

**Feature Branch**: `002-task-export`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Break down all specs into tasks that can easily be converted to Jira or any other platform and are easy to import. Export formats: Jira CSV, Jira REST JSON, GitHub Issues, generic/Linear CSV. Hierarchy: Epic → Story → Sub-task. No estimates."

## Clarifications

### Session 2026-10-28

- Q: How should tasks map into trackers? → A: Feature = Epic, User Story = Story, task = Sub-task;
  Setup/Foundational/Polish tasks become Tasks directly under the Epic.
- Q: Should tasks carry estimates? → A: No estimates; the team estimates during planning.
- Q: Which formats? → A: Jira CSV, Jira REST JSON (+ optional import script), GitHub Issues
  (via `gh`), generic CSV usable by Linear/Azure Boards.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import the whole backlog into Jira via CSV (Priority: P1)

A project lead runs one command and imports the generated CSV with Jira's built-in importer,
getting one Epic per feature, one Story per user story, and Sub-tasks per task, correctly parented.

**Why this priority**: Jira is the primary named target; CSV import needs no API credentials.

**Independent Test**: Export one feature, import into a Jira sandbox project, verify counts and
parent links match `tasks.md`.

**Acceptance Scenarios**:

1. **Given** a feature with 3 user stories and 30 tasks (6 setup/foundational/polish, 24 story
   tasks), **When** exported, **Then** the CSV contains 1 Epic, 3 Stories, 24 Sub-tasks parented to
   their Story, and 6 Tasks parented to the Epic.
2. **Given** a task marked `[P]`, **When** exported, **Then** it carries the label `parallel`.
3. **Given** a task description with commas, quotes and newlines, **When** exported, **Then** the
   CSV cell is correctly quoted and imports unchanged.
4. **Given** all 13 features, **When** exported together, **Then** one CSV is produced with
   globally unique issue identifiers (feature-prefixed, e.g. `004-T012`).

---

### User Story 2 - Create issues through the Jira REST API (Priority: P2)

A lead with API credentials wants issues created automatically, including links, instead of
mapping CSV columns by hand.

**Why this priority**: Faster repeatable import; needs credentials so it is secondary.

**Independent Test**: Run the importer in dry-run mode and inspect the planned requests; run it
against a sandbox and verify created issues.

**Acceptance Scenarios**:

1. **Given** the JSON export, **When** the importer runs with `--dry-run` (the default), **Then** it
   prints the ordered create operations and makes no network calls.
2. **Given** credentials supplied via environment variables, **When** run with `--apply`, **Then**
   Epics are created first, then Stories, then Sub-tasks/Tasks with parent keys resolved from
   previously created issues.
3. **Given** a re-run after a partial failure, **When** run with `--apply`, **Then** already created
   issues (tracked in a local state file by source ID) are skipped, not duplicated.

---

### User Story 3 - Create GitHub Issues (Priority: P2)

A maintainer of the public repo wants the backlog as GitHub Issues with milestones per feature.

**Why this priority**: Public repo collaboration; same dry-run/apply model as Jira.

**Independent Test**: Dry-run prints `gh` commands; apply against a test repo creates issues.

**Acceptance Scenarios**:

1. **Given** the export, **When** dry-run, **Then** the tool prints one milestone per feature and one
   issue per story and task, with task lists linking Story → tasks.
2. **Given** `--apply`, **When** an issue with the same source ID marker already exists, **Then**
   it is skipped.

---

### User Story 4 - Generic CSV for other trackers (Priority: P3)

A team on Linear or Azure Boards imports a flat CSV with parent references.

**Why this priority**: Breadth; simple derivative of the same model.

**Independent Test**: Export and open the CSV; each row has ID, parent ID, type, title,
description, labels, priority.

**Acceptance Scenarios**:

1. **Given** the export, **When** opened, **Then** every row has a non-empty `id` and `type`, and
   every non-Epic row has a `parent_id` present in the file.

### Edge Cases

- Task line not matching the Spec Kit checklist format → export fails, reporting file and line.
- Task with `[USn]` label for a story missing in `spec.md` → export fails with both references.
- Completed tasks (`- [x]`) → exported with status Done (CSV) / skipped on API apply unless
  `--include-done`.
- Feature with `spec.md` but no `tasks.md` → Epic and Stories exported, no tasks, with a warning.
- API rate limiting or 5xx → retried with backoff; 4xx → stops with the response message, state
  file preserved.
- Credentials never written to disk or logs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The tool MUST parse `spec.md` (feature title, user stories with priority) and
  `tasks.md` (checklist task lines, phases, `[P]`, `[USn]`) for every feature under `specs/`.
- **FR-002**: The tool MUST build one tracker-neutral backlog model with Epic → Story → Sub-task and
  Epic → Task relations and stable source IDs (`<feature>-<story|task id>`).
- **FR-003**: The tool MUST emit Jira CSV compatible with Jira Cloud's CSV importer, including
  issue ID and parent ID columns, issue type, summary, description, labels and priority.
- **FR-004**: The tool MUST emit a Jira REST JSON payload and provide an importer that defaults
  to dry-run and requires an explicit apply flag for network calls.
- **FR-005**: The tool MUST emit a GitHub Issues plan and an importer using the GitHub CLI with
  the same dry-run default.
- **FR-006**: The tool MUST emit a generic CSV with `id, parent_id, type, title, description,
  labels, priority, status, feature`.
- **FR-007**: Story priority MUST map P1→High, P2→Medium, P3+→Low; tasks inherit their story's
  priority; non-story tasks get Medium.
- **FR-008**: Labels MUST include the feature slug, phase (`setup`, `foundational`, `us1`, …,
  `polish`), and `parallel` for `[P]` tasks.
- **FR-009**: Descriptions MUST include a back-reference to the source file and line.
- **FR-010**: Importers MUST be idempotent across re-runs using source IDs.
- **FR-011**: Credentials MUST be read only from environment variables and never logged.
- **FR-012**: Output MUST be deterministic for identical input.

### Key Entities

- **BacklogItem**: source ID, type (Epic, Story, Task, Sub-task), title, description, parent
  source ID, labels, priority, status, source location.
- **Backlog**: ordered list of BacklogItems for one or all features.
- **ImportState**: mapping of source ID → created tracker key, per target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The full backlog of all features imports into Jira via CSV with zero manual column
  edits beyond the importer's mapping screen.
- **SC-002**: 100% of tasks in `tasks.md` files appear exactly once in each export format.
- **SC-003**: Re-running an apply after success creates zero new issues.
- **SC-004**: Exporting all features takes under 5 seconds.

## Assumptions

- Jira Cloud (team- or company-managed) with Epic, Story, Task and Sub-task issue types enabled.
- Priority names High/Medium/Low exist in the target Jira scheme.
- The GitHub CLI is installed and authenticated for GitHub apply mode.
- Linear and Azure Boards import via their generic CSV importers; field mapping is done in their UI.
