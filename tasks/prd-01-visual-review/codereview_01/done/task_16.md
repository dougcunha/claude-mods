# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T16 — A merged arrow label shows its states in text and is not a single anchor

## Outcome

An arrow that stands for several relations (a closed container) shows the count of each state in its label text, and its label names all the relations. It takes no comment; its `aria-label` says to open the container to comment on one relation.

## Dependencies and boundaries

- Depends on: —
- Unblocks: T17
- In scope: the merged edge label in `web/app.js`.
- Out of scope: single-relation labels (unchanged).

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-07 | `codereview.md#Findings` | State only by color on a merged edge; a comment anchors to 1 of N relations |

## Requirements

- NFR-07 and `pane-ui.md`: every state has a text or glyph label.
- FR-18: a comment anchors to the element the reviewer chose.

## Context to recover on demand

- TechSpec: CMP-11; PRD UX step 4.
- Code: `web/app.js:graphOf` (merged edges), `BADGES`.

## Work

- [x] T16.1 Count the states of the merged relations; label text `<kind> · N relations (+a −r =u)` with only the non-zero states.
- [x] T16.2 A merged label has no `data-anchor`, an `aria-label` that lists the relations and says to open the container, and the neutral badge class.
- [x] T16.3 Browser check (Playwright, live server, a model with a closed container that merges 2 relations): the label text and that a click opens no form.

## Acceptance criteria

- A merged label shows its states in text, and a click or Enter on it opens no comment form.

## Verification

- Unit: not applicable (page, DEC-07).
- Kit: not applicable.
- Real session: not applicable.
- Manual: Playwright check; owner: the coordinator session.
- Platforms: Windows, Chromium.
- Environment dependency: Node.js on the PATH.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`.
- Expected evidence: the label text and the snapshot.

## Affected files

- Modify: `visual-review/web/app.js`, `visual-review/README.md`

## Observability and recovery

- Operational signal: none.
- Recovery: revert the label code.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: a merged arrow keeps all its relations. Its label reads `<kind> · N relations (<badge><count> ...)` with only the states present (`+` added, `−` removed, `=` unchanged), has no `data-anchor`, a `title` and an `aria-label` that list every relation with its state and say to open the container to comment on one; its line takes no state style (`is-merged`). A single relation keeps its label and anchor (`relationLabel`). README updated.
- Changed files: `visual-review/web/app.js`, `visual-review/README.md`.
- Checks: Playwright Chromium on a live `server.mjs` with a model where `src/cart.Cart` depends on `lib/A` (added) and `lib/B` (unchanged) in the closed container `lib`: label `dependency · 2 relations (+1 =1)`, no anchor, the expected `aria-label`; a click and Enter on it leave the comment form hidden; opening the container shows `dependency · added` and `dependency · unchanged`, each with the `relation` anchor. `claude plugin test visual-review`: 108 pass, 0 fail (same run as T15).
- Validated state: base `8d5ddeb` plus the T01–T16 diff; Windows 11, Playwright Chromium.
- Open items: none.
