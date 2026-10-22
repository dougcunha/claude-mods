# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T11 — Comment changes during a waiting submit neither duplicate nor lose comments

## Outcome

When the page sends a comment set while a submit waits for the idle session, a comment that the submit made open stays 1 open comment, a new draft stays in the store, and the page gets the merged set back.

## Dependencies and boundaries

- Depends on: —
- Unblocks: T12, T15
- In scope: `mergeComments` and a drift check in `hooks/comments.ts`; `saveComments` in `register.tsx` writes `view.json` again when the stored set differs from the set the page sent.
- Out of scope: the page code.

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-02 | `codereview.md#Findings` | Duplicate ids or a lost draft after a submit while Claude is busy |

## Requirements

- FR-22, OBJ-03, DEC-04: comment lines replace the draft set as a whole; a repeated line does not duplicate comments.
- An incoming draft whose id is already a submitted comment is dropped.
- After a merge, when a comment the page sent has another status in the store, or the page sent a draft the store dropped, `view.json` is written again so the page shows the stored set.

## Context to recover on demand

- TechSpec: `#errors-security-and-recovery` (Concurrency and idempotency), `$.store`.
- Code: `hooks/comments.ts:mergeComments`; `register.tsx:saveComments`, `submitReview`, `enqueue`.

## Work

- [x] T11.1 `mergeComments` drops an incoming draft whose id is a submitted comment.
- [x] T11.2 A pure `isPageBehind(incoming, record)` (or similar name) in `comments.ts`: true when the page's statuses differ from the stored ones.
- [x] T11.3 `saveComments` writes `view.json` again with `withComments` when the page is behind.
- [x] T11.4 Unit tests for T11.1 and T11.2; a TC-14 kit case: `comments` (draft X), `submit`, then `comments` (X as draft and a new draft Y) gives 1 open X, 1 draft Y in the store, and a `view.json` with both.

## Acceptance criteria

- No 2 stored comments share an id; the new draft survives and reaches the page.

## Verification

- Unit: `tests/comments.test.ts`.
- Kit: the new TC-14 case in `tests/visual-review.test.ts`.
- Real session: not applicable (the live comment loop stays in manual acceptance).
- Manual: not applicable.
- Platforms: Windows.
- Environment dependency: none.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Expected evidence: test count and exit code 0.

## Affected files

- Modify: `visual-review/hooks/comments.ts`, `visual-review/hooks/register.tsx`, `visual-review/tests/comments.test.ts`, `visual-review/tests/visual-review.test.ts`

## Observability and recovery

- Operational signal: the page redraws with the stored set.
- Recovery: revert the merge rule and the write.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: `mergeComments` drops an incoming draft whose id is already a submitted comment, so a set the page sends while a submit waits keeps that comment open once and keeps the new drafts. `isPageBehind(incoming, record)` is true when a comment the page sent has another stored status, or was dropped. `saveComments` (now given the server handle) writes `view.json` again with the stored set when the page is behind; `refreshView` holds the read and write shared with `submitReview`.
- Changed files: `visual-review/hooks/comments.ts`, `visual-review/hooks/register.tsx`, `visual-review/tests/comments.test.ts`, `visual-review/tests/visual-review.test.ts`.
- Checks: unit: a draft sent again after a submit stays 1 open comment and the new draft gets round 2; `isPageBehind` true for the stale page and false for the stored statuses. Kit (TC-14 case): lines `comments(x)`, `submit`, `comments(x, y)` give 2 prompts (analysis and review) and a last `view.json` with `x` open in round 1 and `y` a draft of round 2. Without the merge rule the store keeps 2 comments `x`; without the refresh the last `view.json` lacks `y` (both read from the code path the test drives). `claude plugin validate visual-review`: passed; `claude plugin test visual-review`: 100 pass, 0 fail; `tsc -p visual-review`: exit 0.
- Validated state: base `8d5ddeb` plus the T01–T11 diff; Windows 11, Claude Code 2.1.308.
- Open items: the live loop in a real session stays in manual acceptance (O-06).
