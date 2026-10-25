# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---


# T16 — Keep link text out of the toasts it does not need

## Outcome

The toasts for a link that failed to open and for a link with `cmd` syntax no longer carry the link text; the FR-15 missing-file toast keeps its path, as FR-15 requires.

## Dependencies and boundaries

- Depends on: T14
- Unblocks: —
- In scope: `register.tsx` open-link failure toast, `viewer.ts` cmd-syntax toast, tests that assert them.
- Out of scope: The FR-15 missing-file toast.

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-04 | `codereview.md#findings` | flow text in toasts against the TechSpec errors and security rule |

## Requirements

- TechSpec Errors and security: no text from the flow in toasts, beyond what FR-15 requires.

## Context to recover on demand

- TechSpec: Errors and security section
- Code: `feature-progress/hooks/register.tsx` `onOpenLink`, `feature-progress/hooks/viewer.ts` `CMD_SYNTAX` branch

## Work

- [x] T16.1 Change both toasts to fixed text that says what failed and what to do.
- [x] T16.2 Update the viewer test that asserts the cmd-syntax toast.

## Acceptance criteria

- Neither toast contains the link.

## Verification

- Unit: `tests/viewer.test.ts`
- Kit: not applicable
- Real session: not applicable
- Manual: not applicable
- Platforms: Windows
- Environment dependency: none
- Commands: `claude plugin validate feature-progress`, `claude plugin test feature-progress` (once, log in the scratchpad), `tsc -p feature-progress`
- Expected evidence: tests pass

## Affected files

- Modify: `feature-progress/hooks/register.tsx`, `feature-progress/hooks/viewer.ts`, `feature-progress/tests/viewer.test.ts`
- Create: —

## Observability and recovery

- Operational signal: not applicable.
- Recovery: revert the files of this task.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: The open-link failure toast says `feature-progress: could not open the task link.` and the cmd-syntax toast says `feature-progress: the task link has a character cmd would read as a command; open the file by hand.`; neither carries the link. The FR-15 missing-file toast keeps its path.
- Changed files: `feature-progress/hooks/register.tsx`, `feature-progress/hooks/viewer.ts`, `feature-progress/tests/viewer.test.ts`
- Checks: `claude plugin test feature-progress` 85 pass, 0 fail (81 before; one run, log in the scratchpad); `claude plugin validate .` and `claude plugin validate feature-progress` pass, no gating hook without `.catch`; `tsc -p feature-progress` no error; TechSpec QA-01 … QA-07 0 blocking hits on the touched files
- Validated state: working tree on base `e58daa9`, Windows 11, Claude Code 2.1.310, kit surfaces terminal and desktop, mod version 0.3.0
- Open items: None.
