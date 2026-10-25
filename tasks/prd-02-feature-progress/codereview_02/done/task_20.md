# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/codereview_02/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T20 — The label contract says the task word stays

## Outcome

The README input table and the TechSpec contract say that a feature `label` replaces the state word in the band and the chip, and that a task `label` shows next to the word for its kind, as the pane draws since T15.

## Dependencies and boundaries

- Depends on: —
- Unblocks: —
- In scope: `feature-progress/README.md` input rows, `techspec.md` contract rows 80 and 86, the checkpoint hash.
- Out of scope: code.

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_02/CR-02 | `codereview.md#findings` | README and TechSpec still say a task label replaces the state word |

## Requirements

- FR-21: the README contract matches the behavior; NFR-04: the word for the kind stays.

## Context to recover on demand

- Code: `feature-progress/hooks/progress.ts` `stageText`, `kindText`

## Work

- [x] T20.1 Edit the 2 README rows and the 2 TechSpec rows.
- [x] T20.2 Update the TechSpec hash in the checkpoint.

## Acceptance criteria

- No row says a task label replaces the state word.

## Verification

- Unit: not applicable
- Kit: not applicable
- Real session: not applicable
- Manual: not applicable
- Platforms: Windows
- Environment dependency: none
- Commands: `rg -n "instead of the" feature-progress/README.md tasks/prd-02-feature-progress/techspec.md`
- Expected evidence: grep output in the handoff

## Affected files

- Modify: `feature-progress/README.md`, `tasks/prd-02-feature-progress/techspec.md`
- Create: —

## Observability and recovery

- Operational signal: not applicable.
- Recovery: revert the rows.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: `feature-progress/README.md:72,78` and `techspec.md:80,86` say a feature `label` replaces the state word in the band and the chip, and a task `label` shows next to the kind word (`review #1 · Revisão`). TechSpec sha256 `8267f586…` in the checkpoint (W-15).
- Changed files: `feature-progress/README.md`, `tasks/prd-02-feature-progress/techspec.md`
- Checks: `rg -n "instead of the|next to the"`: the 2 feature rows say band and chip; the 2 task rows say next to the word; `claude plugin validate .` passes.
- Validated state: working tree on base `e58daa9`, Windows 11, mod 0.3.0; documentation only.
- Open items: None.
