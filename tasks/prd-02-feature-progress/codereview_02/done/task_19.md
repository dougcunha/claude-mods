# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/codereview_02/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T19 — A band screenshot of 0.3.0, or a recorded decision without it

## Outcome

`feature-progress/images/band.png` holds a cropped screenshot of the 0.3.0 band, shown in the README; or `workflow.md` records the user's decision to accept the README without it.

## Dependencies and boundaries

- Depends on: —
- Unblocks: —
- In scope: `feature-progress/images/band.png`, the README image block, the T12 and T09 handoffs.
- Out of scope: code changes.

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_02/CR-01 | `codereview.md#findings` | no band screenshot after T11 redrew the band |

## Requirements

- `tests.md:43`, `pane-ui.md:38`: screenshots of the drawing, replaced when the drawing changes.

## Context to recover on demand

- Code: `feature-progress/README.md` image block under What it does

## Work

- [x] T19.1 The user sends a cropped screenshot of the band above the prompt, or decides to accept the README without it.
- [x] T19.2 Save it as `feature-progress/images/band.png` and add it to the README, or record the decision in `workflow.md`; update the T12 and T09 open items.

## Acceptance criteria

- The README shows the band, or `workflow.md` holds the user's decision.

## Verification

- Unit: not applicable
- Kit: not applicable
- Real session: the user's session with the mod 0.3.0
- Manual: T19.1, owner: the user
- Platforms: Windows
- Environment dependency: the user's real terminal; escalated (AUTO-10)
- Commands: `claude plugin validate feature-progress`
- Expected evidence: `feature-progress/images/band.png` or a `W-NN` record

## Affected files

- Modify: `feature-progress/README.md`, `tasks/prd-02-feature-progress/done/task_09.md`, `tasks/prd-02-feature-progress/codereview_01/done/task_12.md`
- Create: `feature-progress/images/band.png`

## Observability and recovery

- Operational signal: not applicable.
- Recovery: remove the image.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: the user sent a screenshot of the 0.3.0 band (W-16); cropped to the band row (560x34) as `feature-progress/images/band.png` and shown above the pane images in `feature-progress/README.md` and in the root `README.md`.
- Changed files: `feature-progress/images/band.png` (new), `feature-progress/README.md`, `README.md`, `done/task_09.md` and `codereview_01/done/task_12.md` open items.
- Checks: the band draws glyph, title, `waiting` chip, meter and `26/29` in the user terminal; `claude plugin validate .` and `claude plugin validate feature-progress` pass.
- Validated state: the user session on Windows 11, Claude Code 2.1.310, mod 0.3.0.
- Open items: None.
