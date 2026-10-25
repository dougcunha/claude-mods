# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T06 — Document and register the mod

## Outcome

`feature-progress/README.md` lets another flow integrate without reading code: tool name, input schema, merge and `remove` rules, the 9 kinds, timestamps, storage folder with a `.gitignore` recommendation, 2 example calls, the band and pane, each `userConfig` option, the delete command, limitations and an Install section. The mod is in `.claude-plugin/marketplace.json` and in the root README Mods table, and `.agents/rules/mod-runtime.md` records the storage exception.

## Dependencies and boundaries

- Depends on: T05
- Unblocks: T09
- In scope: the mod README, the marketplace entry, the root README row, the rule exception.
- Out of scope: screenshots (added in T09 when the look is confirmed), the tested-version badge value (T09).

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-21, OBJ-02, US-04 | `prd.md` | README contract for other flows |
| DEC-01 | `techspec.md#technical-decisions` | Exception in `mod-runtime.md` |
| DEC-05, DEC-06 | `techspec.md#technical-decisions` | README states the delete command and the band limitation |
| CMP-15, CMP-16, CMP-17 | `techspec.md#components-and-flow` | README, marketplace, root README, rule |

## Context to recover on demand

- Applicable skills and rules: `AGENTS.md` (Adding or changing a mod); `.agents/rules/pane-ui.md` (README and screenshots).
- Existing code: `visual-review/README.md` (a recent mod README with an Install section), `.claude-plugin/marketplace.json`, `README.md` Mods table.
- Contract or integration: `techspec.md#contracts-and-data` (tool table, stored file example, `userConfig`), `techspec.md#risks-and-open-items`.
- Engine reference: not applicable.

## Work

- [x] T06.1 Write `feature-progress/README.md`: sections, contract with a create example and a `done` example, options, delete command, limitations (no live updates, band hidden by a mod that does not call `next`, macOS and Linux unverified), Install with `/plugin install feature-progress --marketplace dougcunha/claude-mods`.
- [x] T06.2 Add the mod to `.claude-plugin/marketplace.json` and its row to the root `README.md` Mods table.
- [x] T06.3 Add the DEC-01 exception to the Files section of `.agents/rules/mod-runtime.md`.

## Acceptance criteria

- A reviewer who reads only the README writes a valid first call and a valid update call.
- `claude plugin validate .` passes with the new marketplace entry.
- The rule names the exception scope: the configured folder and `<id>.json` files the mod creates.

## Verification

- Unit: not applicable.
- Kit: not applicable.
- Real session: T09 follows the README examples.
- Manual: review of the README against the tool input table in the TechSpec.
- Platforms: not applicable.
- Commands: `claude plugin validate .`, `claude plugin validate feature-progress`.
- Environment dependency: none.
- Expected evidence: validation passes; the README examples match `REPORT_SPEC`.

## Affected files

- Create: `feature-progress/README.md`
- Modify: `.claude-plugin/marketplace.json`, `README.md`, `.agents/rules/mod-runtime.md`

## Observability and recovery

- Operational signal: not applicable.
- Recovery: revert the task's commit.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: `feature-progress/README.md` with what the band and the pane show, Install (with the `.gitignore` line), the report contract (input table, merge rules, the 9 states, 3 example calls, the stored file), Use, Settings, Limitations (no live updates, band hidden by a mod that does not call `next`, files in the repository, delete command, Windows link guard, two sessions, size, platforms) and Development. The mod is in `.claude-plugin/marketplace.json` and in the root README Mods table. `.agents/rules/mod-runtime.md` records the DEC-01 exception in its Files section.
- Changed files: created `feature-progress/README.md`; modified `.claude-plugin/marketplace.json`, `README.md`, `.agents/rules/mod-runtime.md`.
- Checks: `claude plugin validate .` passed; `claude plugin validate feature-progress` passed. Review of the README examples against `REPORT_SPEC` and `parseReport`: the field names, the clear rules (`""`, `null`) and the state list match.
- Validated state: Windows 11, Claude Code 2.1.310. `.agents/` is in the root `.gitignore`, so the `mod-runtime.md` exception is a local change of the rules copy; Git does not track it.
- Open items: screenshots and a tested-version check after a real load stay in T09.

### ADR candidates

None - direct TechSpec implementation or local decision.
