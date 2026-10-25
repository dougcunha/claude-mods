# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---


# T17 — Record the pane state keys the code uses in the TechSpec

## Outcome

The TechSpec `$.state` contract names `features`, `warnings` and `toggled`, says the pane reads whether it is open from `$.ui.panes()`, and drops `isPaneOpen`.

## Dependencies and boundaries

- Depends on: —
- Unblocks: —
- In scope: `techspec.md` Contracts (`$.state`), `approved_sources` hash and the decision record.
- Out of scope: Code changes.

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-06 | `codereview.md#findings` | TechSpec lists `isPaneOpen`; the code has `toggled` and reads `$.ui.panes()` |

## Requirements

- The approved contract matches the code; the change is recorded as a decision (AUTO-08).

## Context to recover on demand

- TechSpec: Contracts, `$.state`
- Code: `feature-progress/types/index.d.ts`, `done/task_04.md` handoff

## Work

- [x] T17.1 Edit the `$.state` contract rows and add the reason (the pane state comes from the engine, so it cannot drift after `/clear`).
- [x] T17.2 Update the TechSpec hash in the checkpoint with the AUTO-08 decision.

## Acceptance criteria

- `rg -n "isPaneOpen" tasks/prd-02-feature-progress/techspec.md` finds nothing; the contract names `toggled`.

## Verification

- Unit: not applicable
- Kit: not applicable
- Real session: not applicable
- Manual: not applicable
- Platforms: Windows
- Environment dependency: none
- Commands: `rg -n "isPaneOpen|toggled" tasks/prd-02-feature-progress/techspec.md feature-progress/types/index.d.ts`
- Expected evidence: grep output in the handoff

## Affected files

- Modify: `tasks/prd-02-feature-progress/techspec.md`
- Create: —

## Observability and recovery

- Operational signal: not applicable.
- Recovery: revert the files of this task.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: The TechSpec `$.state` contract names `toggled: string[]` and says the pane open state comes from `$.ui.panes()`; the `isPaneOpen` row is gone (AUTO-08). New TechSpec sha256 `9018b68d…` recorded in the checkpoint with W-12.
- Changed files: `tasks/prd-02-feature-progress/techspec.md`
- Checks: `rg -n "isPaneOpen" techspec.md feature-progress/hooks feature-progress/types`: 0 hits; `types/index.d.ts:46` declares `toggled`
- Validated state: working tree on base `e58daa9`, Windows 11, Claude Code 2.1.310, kit surfaces terminal and desktop, mod version 0.3.0
- Open items: None.
