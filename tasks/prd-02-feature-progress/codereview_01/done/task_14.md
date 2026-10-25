# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---


# T14 — Catch the rejections of the pane callbacks

## Outcome

The band press and the pane toggle catch a rejected promise: the band press toasts, the toggle state update falls back silently.

## Dependencies and boundaries

- Depends on: T13
- Unblocks: —
- In scope: `register.tsx` callbacks that start a promise with `void`.
- Out of scope: Other hooks.

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-05 | `codereview.md#findings` | `void` promises without `.catch` (`javascript-typescript.md:44`) |

## Requirements

- `javascript-typescript.md`: do not leave a promise floating; a best-effort call ends in `.catch(() => undefined)`, a call the person waits on says the failure.

## Context to recover on demand

- Rules: `.agents/rules/javascript-typescript.md`
- Code: `feature-progress/hooks/register.tsx` `onOpen`, `onToggle`

## Work

- [x] T14.1 Add `.catch` to the band press (toast) and to the toggle update (`() => undefined`).
- [x] T14.2 Grep `void ` in `register.tsx`: every hit ends in `.catch`.

## Acceptance criteria

- No `void` call in `register.tsx` lacks a `.catch`.

## Verification

- Unit: not applicable
- Kit: existing band and pane tests still pass
- Real session: not applicable
- Manual: not applicable
- Platforms: Windows
- Environment dependency: none
- Commands: `claude plugin validate feature-progress`, `claude plugin test feature-progress` (once, log in the scratchpad), `tsc -p feature-progress`; `rg -n "void " feature-progress/hooks/register.tsx`
- Expected evidence: grep output and test tally in the handoff

## Affected files

- Modify: `feature-progress/hooks/register.tsx`
- Create: —

## Observability and recovery

- Operational signal: not applicable.
- Recovery: revert the files of this task.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: Every `void` call in `register.tsx` ends in `.catch`: the band press toasts `feature-progress: could not open the pane.`, the toggle update and the `/clear` poll fall back to `undefined`.
- Changed files: `feature-progress/hooks/register.tsx`
- Checks: `claude plugin test feature-progress` 85 pass, 0 fail (81 before; one run, log in the scratchpad); `claude plugin validate .` and `claude plugin validate feature-progress` pass, no gating hook without `.catch`; `tsc -p feature-progress` no error; TechSpec QA-01 … QA-07 0 blocking hits on the touched files; `rg -n "void " feature-progress/hooks/register.tsx`: 6 calls, all with `.catch`
- Validated state: working tree on base `e58daa9`, Windows 11, Claude Code 2.1.310, kit surfaces terminal and desktop, mod version 0.3.0
- Open items: None.
