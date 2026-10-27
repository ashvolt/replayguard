# Quickstart: Diagrams-as-Code

1. Create `specs/NNN-feature/diagram.yaml` (see `contracts/diagram-yaml.md`).
2. Generate: `pnpm diagrams:generate --feature NNN-feature`
3. Open `specs/NNN-feature/diagrams/hld.excalidraw` at https://excalidraw.com (File → Open) or in
   the VS Code Excalidraw extension; preview `hld.svg` on GitHub.
4. Verify traceability: `pnpm diagrams:check` → every `T###` from `tasks.md` must be listed in some
   node or message `tasks` array.
5. Commit YAML and generated outputs together (CI fails on stale outputs).

## Validation scenarios

- Remove a task ID from YAML → `check` fails with `untraced`.
- Edit a label without regenerating → `check` fails with `stale`.
- Generate twice → `git diff` is empty.
