# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---


# T18 — Name the band argument in the root Mods table

## Outcome

The root README Mods row shows `/feature-progress [band|clean]`, as the command's `argumentHint`.

## Dependencies and boundaries

- Depends on: —
- Unblocks: —
- In scope: `README.md` Mods table row.
- Out of scope: Other rows.

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-07 | `codereview.md#findings` | root README omits the `band` argument |

## Requirements

- CMP-16: the root README row lists the mod's command as it is registered.

## Context to recover on demand

- Code: `README.md` line of `feature-progress`, `feature-progress/hooks/register.tsx` `COMMAND`

## Work

- [x] T18.1 Change the command cell.

## Acceptance criteria

- The cell equals the registered argument hint.

## Verification

- Unit: not applicable
- Kit: not applicable
- Real session: not applicable
- Manual: not applicable
- Platforms: Windows
- Environment dependency: none
- Commands: `claude plugin validate .`
- Expected evidence: validate passes

## Affected files

- Modify: `README.md`
- Create: —

## Observability and recovery

- Operational signal: not applicable.
- Recovery: revert the files of this task.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: The root Mods row shows `/feature-progress [band\|clean]`.
- Changed files: `README.md`
- Checks: `claude plugin validate .` passes
- Validated state: working tree on base `e58daa9`, Windows 11, Claude Code 2.1.310, kit surfaces terminal and desktop, mod version 0.3.0
- Open items: None.
