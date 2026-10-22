# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T15 — The page says "Review sent" only when the review entered the session

## Outcome

After "Submit review", the page says that the review waits for the session. It says "Review sent" when the mod writes the next round, and it shows the cause when the mod sent nothing or the prompt was dropped. With nothing to send, the page says so without a request.

## Dependencies and boundaries

- Depends on: T11, T12
- Unblocks: T17
- In scope: an optional `notice` in the view model (`hooks/view.ts`), written by `submitReview` in `register.tsx` for "nothing to send" and "dropped"; the page text in `web/app.js`.
- Out of scope: the server (`/submit` stays 202).

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-08 | `codereview.md#Findings` | "Review sent" shows also when nothing is sent or the prompt is dropped |

## Requirements

- FR-20 and PRD UX step 6: the page shows "Review sent" after the submit; the person must not read it when nothing went to the session.
- The notice text names no prompt or comment text (`code-standards.md`, sensitive data); it reuses the toast causes.

## Context to recover on demand

- TechSpec: `#contracts-and-data` (view model, text the mod adds), CMP-06, CMP-11.
- Code: `register.tsx:submitReview`; `hooks/view.ts:ViewModel`, `withComments`; `web/app.js` submit handler and `show`.

## Work

- [x] T15.1 `ViewModel.notice: string | null` (null by default); `submitReview` writes `view.json` with the notice for "nothing to send" and "dropped", and with `notice: null` and the new round after a sent review.
- [x] T15.2 Page: a 202 shows "Review handed to the session. It enters when Claude is idle."; a model with a higher round shows "Review sent"; a model with a notice shows it; no request when there is no draft and no status change.
- [x] T15.3 Kit tests: a submit with nothing new writes the notice; a dropped review prompt writes the notice and keeps the round; TC-14 checks `notice: null`.
- [x] T15.4 Browser check (Playwright, live server): the 3 page texts.

## Acceptance criteria

- The page never says "Review sent" for a review that did not enter the session.

## Verification

- Unit: view model default.
- Kit: the 3 cases.
- Real session: not applicable.
- Manual: Playwright on a live `server.mjs` with a fake comment and submit line flow; owner: the coordinator session.
- Platforms: Windows, Chromium.
- Environment dependency: Node.js on the PATH.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Expected evidence: test count and exit code 0; page texts.

## Affected files

- Modify: `visual-review/hooks/view.ts`, `visual-review/hooks/register.tsx`, `visual-review/web/app.js`, `visual-review/tests/view.test.ts`, `visual-review/tests/visual-review.test.ts`, `visual-review/README.md`

## Observability and recovery

- Operational signal: the page status text; the CLI toast stays.
- Recovery: revert the field and the page text.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: the view model has `notice: { text, at } | null` (null from `buildView`; every `withComments` write sets it, null by default; `at` makes a repeated notice new file content, so the server sends it). `submitReview` writes `view.json` with a notice when nothing is new (`NOTHING_TO_SEND_NOTICE`) or the review prompt was dropped (`reviewDroppedNotice`), keeping the round and the drafts; a sent review writes the next round with `notice: null`. The CLI toasts stay. Page: with no draft and no status change (the page's own or a stored `isStatusChanged`) it says so with no request; otherwise it sets the round it waits on before `POST /submit` (the model can arrive first), shows `Review handed to the session. It enters when Claude is idle.` on 202, then `Review sent.` on a model with a higher round, or the notice text. README updated.
- Changed files: `visual-review/hooks/view.ts`, `visual-review/hooks/register.tsx` (`refreshView` takes a notice), `visual-review/hooks/prompts.ts` (notice texts), `visual-review/web/app.js`, `visual-review/tests/visual-review.test.ts` (world option `reviewDrop`, `noticeOf`), `visual-review/README.md`.
- Checks: kit: nothing to send writes the notice; a dropped review prompt keeps round 1 and the draft and writes the dropped notice; TC-14 ends with `notice: null`; TC-06 asserts `notice: null` in the first `view.json`. Browser (Playwright Chromium, live `server.mjs`, `view.json` written by hand as the mod would): empty submit → `The review has no new comment and no status change to send.`; a draft then submit → `Review handed to the session. It enters when Claude is idle.` and 1 `submit` line from the server; a model with the dropped notice → the notice text; submit again, then a model with round 2 → `Review sent.` and the comment under "Earlier rounds". `claude plugin validate .` and `visual-review`: passed; `claude plugin test visual-review`: 108 pass, 0 fail; `tsc -p visual-review`: exit 0.
- Validated state: base `8d5ddeb` plus the T01–T16 diff; Windows 11, Node.js v24.20.0, Playwright Chromium.
- Open items: the outcome in a live session (a real prompt that waits for the idle session) stays in manual acceptance (O-06).
