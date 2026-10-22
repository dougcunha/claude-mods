# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T13 — The command clears a failed run and says when the tool is missing

## Outcome

A failure after the run is saved clears `pendingRun` and the status, and the command answers with the cause. When the `submit_model` tool did not register, the command answers that the tool is missing and submits no prompt.

## Dependencies and boundaries

- Depends on: —
- Unblocks: T14
- In scope: `command.run` and `session.start` in `register.tsx`, a missing-tool text in `prompts.ts`.
- Out of scope: the TechSpec text (the code follows it).

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-05 | `codereview.md#Findings` | The `command.run` failure path leaves `pendingRun` and the status set |
| codereview_01/CR-06 | `codereview.md#Findings` | The command never says that the tool is missing |

## Requirements

- TechSpec integrations: `command.run` failure answers `visual-review: <cause>` and clears `pendingRun`; a failed tool registration leaves the command, which then says the tool is missing.
- A `.catch` handler cannot call `$` on a re-entry (`mod-hooks.md`): the clear runs inside the hook.
- The registration flag is a module value: a reload registers again and sets it again.

## Context to recover on demand

- TechSpec: `#integrations-and-interfaces`.
- Rules: `mod-hooks.md` (failure model, critical areas).
- Code: `register.tsx:startRun`, `endRun`, `session.start`, `command.run`.

## Work

- [x] T13.1 `command.run`: a `try`/`catch` around `startRun` ends the run (state and status) and answers with the cause.
- [x] T13.2 `session.start` keeps whether the tool registered; `command.run` answers `TOOL_MISSING_TEXT` (in `prompts.ts`) before it collects, when it did not.
- [x] T13.3 Kit tests: a status call that fails after the run is saved leaves no run (a later `submit_model` gets the no-run result) and answers the cause; a refused tool registration makes the command answer the missing-tool text with no prompt.

## Acceptance criteria

- The 2 kit tests pass on the `terminal` and `desktop` surfaces where the answer is drawn by the hook (loop over both).

## Verification

- Unit: the exact missing-tool text.
- Kit: the 2 cases in `tests/visual-review.test.ts`.
- Real session: not applicable.
- Manual: not applicable.
- Platforms: Windows.
- Environment dependency: none.
- Commands: `claude plugin validate visual-review` (gating hooks still `with .catch`), `claude plugin test visual-review`, `tsc -p visual-review`.
- Expected evidence: test count and exit code 0; the validate list.

## Affected files

- Modify: `visual-review/hooks/register.tsx`, `visual-review/hooks/prompts.ts`, `visual-review/tests/visual-review.test.ts`

## Observability and recovery

- Operational signal: the command text.
- Recovery: revert the 2 hooks.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: `startRun` builds the analysis prompt before it saves the run, so the state write is its last awaited step; after it only `$.ui.status` and `$.clock.after` run, which return nothing. `command.run` wraps `startRun` in `try`/`catch`: a failure clears `pendingRun` and the status inside the hook and answers `visual-review: <cause>`. `session.start` keeps `isToolMissing` (a value of the module life, set again by each registration); while it is true, the command answers `TOOL_MISSING_TEXT` before it collects anything.
- Changed files: `visual-review/hooks/register.tsx`, `visual-review/hooks/prompts.ts` (`TOOL_MISSING_TEXT`), `visual-review/tests/visual-review.test.ts` (world option `isToolRefused`).
- Checks: kit, terminal and desktop: a refused tool registration toasts the cause, and the command answers the exact missing-tool text with no prompt and no status. Kit: a `state.set` that is denied (a throwing hook is skipped by the engine and the write lands, so the test denies) makes the command answer `visual-review: <cause>` with no prompt and no status left. Without the `try`/`catch` the `.catch` handler gives the same answer for this case, so the test proves the behavior, not which of the 2 paths gave it; no awaited step after the state write is left that the kit could fail. `claude plugin validate visual-review`: passed (gating hooks `command.run` and `tool.call` with `.catch`); `claude plugin test visual-review`: 105 pass, 0 fail; `tsc -p visual-review`: exit 0.
- Validated state: base `8d5ddeb` plus the T01–T13 diff; Windows 11, Claude Code 2.1.308.
- Open items: none.
