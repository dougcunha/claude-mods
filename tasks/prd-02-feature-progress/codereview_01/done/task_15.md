# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---


# T15 — Each task row shows the word for its kind

## Outcome

A task row shows its glyph and the word for its kind; a `label` shows next to the kind word, not instead of it.

## Dependencies and boundaries

- Depends on: —
- Unblocks: —
- In scope: `pane.tsx` task details, a helper for the task stage text in `progress.ts`, tests.
- Out of scope: The feature chip and the band, which already follow FR-09.

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-03 | `codereview.md#findings` | FR-12, NFR-04: a task `label` hides the word for its kind |

## Requirements

- NFR-04: a state is never shown by color only; each kind has an icon and a word.
- FR-12: the task row shows the state, the round, the steps, the duration and the note.

## Context to recover on demand

- PRD: FR-12, NFR-04
- Code: `feature-progress/hooks/pane.tsx` `taskRow`, `feature-progress/hooks/progress.ts` `stageText`

## Work

- [x] T15.1 Add `kindText(item)`: the kind with `#round`, then ` · label` when a label exists; use it in the task row.
- [x] T15.2 Unit test for `kindText`; kit assertion of the glyph and the kind word of a labelled task.

## Acceptance criteria

- A task with `label: "Revisão"` and state `review` shows `review` and `Revisão`.

## Verification

- Unit: `tests/progress.test.ts` `kindText`
- Kit: `tests/pane.test.ts`, terminal and desktop
- Real session: not applicable
- Manual: not applicable
- Platforms: Windows
- Environment dependency: none
- Commands: `claude plugin validate feature-progress`, `claude plugin test feature-progress` (once, log in the scratchpad), `tsc -p feature-progress`
- Expected evidence: tests pass

## Affected files

- Modify: `feature-progress/hooks/pane.tsx`, `feature-progress/hooks/progress.ts`, `feature-progress/tests/pane.test.ts`, `feature-progress/tests/progress.test.ts`
- Create: —

## Observability and recovery

- Operational signal: not applicable.
- Recovery: revert the files of this task.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: `kindText` draws `<kind>[ #round][ · label]` in the task row, so a labelled task keeps the word for its kind; the feature chip and the band keep `stageText` (FR-09). New unit test and a kit test on terminal and desktop (glyph `◎` and `review #1 · Revisão`).
- Changed files: `feature-progress/hooks/progress.ts`, `feature-progress/hooks/pane.tsx`, `feature-progress/tests/progress.test.ts`, `feature-progress/tests/pane.test.ts`
- Checks: `claude plugin test feature-progress` 85 pass, 0 fail (81 before; one run, log in the scratchpad); `claude plugin validate .` and `claude plugin validate feature-progress` pass, no gating hook without `.catch`; `tsc -p feature-progress` no error; TechSpec QA-01 … QA-07 0 blocking hits on the touched files
- Validated state: working tree on base `e58daa9`, Windows 11, Claude Code 2.1.310, kit surfaces terminal and desktop, mod version 0.3.0
- Open items: None.
