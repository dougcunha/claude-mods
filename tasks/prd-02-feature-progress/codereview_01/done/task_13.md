# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---


# T13 — Pressing the band opens the pane and never closes it

## Outcome

A press on the band opens the pane with focus when it is closed, and focuses it when it is open. `/feature-progress` keeps its toggle.

## Dependencies and boundaries

- Depends on: —
- Unblocks: T14
- In scope: `register.tsx` (a pane-open function for the band), a kit test of the open-pane case.
- Out of scope: The command's toggle.

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-02 | `codereview.md#findings` | FR-10: the band press closes an open pane |

## Requirements

- FR-10: the band press opens the pane; `$.ui.open` on an open id retitles, and `focus: true` moves the focus to it (`index.d.ts`, `$.ui.open`).
- A pane the terminal is too narrow for toasts as the command does.

## Context to recover on demand

- TechSpec: FR-10 row of the traceability table
- Code: `feature-progress/hooks/register.tsx` `togglePane`, `tests/pane.test.ts` `pressing the band opens the pane`

## Work

- [x] T13.1 Split `togglePane` into `openPane` (open with focus, toast when not placed) and the toggle that calls it; the band calls `openPane`.
- [x] T13.2 Kit test: with the pane open, a band press leaves it open.

## Acceptance criteria

- A band press never closes the pane.
- The command still opens and closes it.

## Verification

- Unit: not applicable
- Kit: `tests/pane.test.ts`, terminal: band press with the pane closed and open
- Real session: not applicable
- Manual: not applicable
- Platforms: Windows
- Environment dependency: none
- Commands: `claude plugin validate feature-progress`, `claude plugin test feature-progress` (once, log in the scratchpad), `tsc -p feature-progress`
- Expected evidence: kit tests pass

## Affected files

- Modify: `feature-progress/hooks/register.tsx`, `feature-progress/tests/pane.test.ts`
- Create: —

## Observability and recovery

- Operational signal: not applicable.
- Recovery: revert the files of this task.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: `openPane` opens the pane with focus (an open id is only focused); `togglePane` calls it when the pane is closed and closes it otherwise; the band press calls `openPane`. New kit test: the band press with the pane open keeps it open.
- Changed files: `feature-progress/hooks/register.tsx`, `feature-progress/tests/pane.test.ts`
- Checks: `claude plugin test feature-progress` 85 pass, 0 fail (81 before; one run, log in the scratchpad); `claude plugin validate .` and `claude plugin validate feature-progress` pass, no gating hook without `.catch`; `tsc -p feature-progress` no error; TechSpec QA-01 … QA-07 0 blocking hits on the touched files
- Validated state: working tree on base `e58daa9`, Windows 11, Claude Code 2.1.310, kit surfaces terminal and desktop, mod version 0.3.0
- Open items: None.
