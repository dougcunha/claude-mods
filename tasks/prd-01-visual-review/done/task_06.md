# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/prd.md`
2. `tasks/prd-01-visual-review/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T06 — Comments and review submit

## Outcome

The reviewer adds, edits and deletes comments on a unit, member, relation, table, column or the whole review, with the type "Change request" or "Question". Each change reaches `$.store` through the server. "Submit review" sends 1 review prompt to the session when it is idle, and the page shows "Review sent". On the next run, the earlier comments show with the status open or resolved, and comments whose anchor is gone show in "Unanchored".

## Dependencies and boundaries

- Depends on: T05
- Unblocks: T07
- In scope: `comments.ts`, the review prompt in `prompts.ts`, comments in `view.ts`, `POST /comments` and `POST /submit` in the server, `comments` and `submit` lines in `server.ts`, the comment UI and side panel in the page, store pruning.
- Out of scope: "Copy review" in static mode (T07).

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| OBJ-02, OBJ-03 | `prd.md#outcomes-and-metrics` | Review in 1 action; comments across rounds |
| FR-18 to FR-23 | `prd.md#functional-requirements` | Anchors, prompt, submit, store, unanchored |
| NFR-07, NFR-09 | `prd.md#non-functional-requirements` | Keyboard for comments; store limit |
| DEC-04 | `techspec.md#technical-decisions` | Comment lines to `$.store` |
| CMP-06, CMP-07, CMP-08, CMP-10, CMP-11 | `techspec.md#components-and-flow` | View comments, store, prompt, routes, UI |
| TC-11, TC-12, TC-13 (review), TC-14 | `techspec.md#test-approach` | Merge and status, pruning, prompt text, submit |

## Context to recover on demand

- Applicable skills and rules: `.agents/rules/mod-hooks.md` (critical: prompt text, `$.store` keys), `javascript-typescript.md` ("Validate what you do not own"), `tests.md` ("Agent-facing text", "State").
- Existing code: `visual-review/hooks/server.ts`, `visual-review/server/server.mjs`, `visual-review/web/app.js` (from T04 and T05).
- Contract or integration: `techspec.md#contracts-and-data` (`$.store`, Comment, Server lines, review prompt), `techspec.md#components-and-flow` (flow step 5).
- Engine reference: `$.store.get`, `set`, `keys`, `delete`; `$.prompt.submit`.

## Work

- [x] T06.1 Create `hooks/comments.ts`: store key from root and branch, narrowing, merge of a draft set, status change, round on submit, anchor resolution, pruning above `STORE_SOFT_LIMIT_BYTES`.
- [x] T06.2 Add the review prompt to `hooks/prompts.ts`; add comments and the unanchored list to `hooks/view.ts`.
- [x] T06.3 Server: `POST /comments` and `POST /submit` with the token header and the 1 MiB body limit; print `comments` and `submit` lines.
- [x] T06.4 `register.tsx`: on `comments`, save; on `submit`, build the prompt, call `$.prompt.submit`, mark drafts open, write `view.json` again.
- [x] T06.5 Page: comment form per anchor, side panel, status switch, "Submit review", "Review sent", keyboard access.
- [x] T06.6 Write `tests/comments.test.ts` (TC-11, TC-12), extend `tests/prompts.test.ts` (TC-13 review) and the kit test TC-14.

## Acceptance criteria

- A comment on each of the 6 anchor kinds shows next to its anchor and in the panel.
- After submit, the session shows the review prompt with each comment, its anchor and type, and Claude changes no file before the user confirms.
- After a rerun, old comments show with status; a comment on a deleted method shows in "Unanchored".
- Store keys above the soft limit lose the oldest key first.

## Verification

- Unit: TC-11, TC-12, TC-13 (review prompt, exact text).
- Kit: TC-14 (a `submit` line leads to `prompt.submit` with the review prompt).
- Real session: comment on a class, a method, an arrow, a table, a column and the review; submit; check the prompt; ask Claude to change 1 thing; rerun; mark resolved.
- Manual: keyboard-only comment flow (part of TC-19); owner: the developer.
- Platforms: Windows.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Environment dependency: Node.js on the PATH.
- Expected evidence: test count and exit code 0; the review prompt in the session; the rerun panel.

## Affected files

- Modify: `visual-review/hooks/prompts.ts`, `visual-review/hooks/view.ts`, `visual-review/hooks/server.ts`, `visual-review/hooks/register.tsx`, `visual-review/hooks/host.ts`, `visual-review/server/server.mjs`, `visual-review/web/app.js`, `visual-review/web/style.css`, `visual-review/tests/prompts.test.ts`, `visual-review/tests/view.test.ts`, `visual-review/tests/visual-review.test.ts`
- Create: `visual-review/hooks/comments.ts`, `visual-review/tests/comments.test.ts`

## Observability and recovery

- Operational signal: "Review sent" on the page; a toast when `$.prompt.submit` drops the prompt.
- Recovery: the comments stay in `$.store`; a failed submit keeps them as drafts.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: the reviewer comments on a unit, member, relation, table, column or the whole review, with the type "Change request" or "Question", from a click or Enter on the element (members and columns take the focus) or the "Comment on the whole review" button; edits and deletes drafts; switches older comments between open and resolved. The page posts the whole comment set to `POST /comments` (header token, 1 MiB limit); the server prints a `comments` line; the mod merges it into `$.store` under `review:<root key>:<branch>` (drafts replaced as a set, older comments take only their status) and prunes the oldest review keys above 3 MiB. "Submit review" posts `/submit` (202, the page shows "Review sent"); the mod sends 1 review prompt (drafts by anchor with type, then status changes; answer questions, plan change requests, no file change before confirmation) through `$.prompt.submit`, which waits for the idle session; once it entered, the drafts become open comments of a new round and `view.json` is written again. Every `view.json` carries the round and the stored comments with `isAnchored`; the page lists "This round", "Earlier rounds" and "Unanchored", and shows a count next to each anchor. Server lines are handled one at a time in order, so a submit sees the comments sent before it.
- Changed files: created `visual-review/hooks/comments.ts`, `tests/comments.test.ts`; modified `hooks/prompts.ts` (review prompt and toasts), `hooks/view.ts` (`round`, `comments`, `anchorsOf`, `withComments`, `isViewModel`), `hooks/server.ts` (`comments`, `submit` lines), `hooks/host.ts` (`store*`), `hooks/register.tsx`, `server/server.mjs` (`POST /comments`, `POST /submit`), `web/index.html`, `web/app.js`, `web/style.css`, `tests/prompts.test.ts`, `tests/view.test.ts`, `tests/visual-review.test.ts`, `README.md`.
- Checks:
  - `claude plugin test visual-review`: 83 pass, 0 fail (8 files). `tsc -p visual-review`: exit 0. `claude plugin validate visual-review`: passed.
  - Unit: TC-11 (merge replaces drafts and is idempotent; submit opens drafts and starts a round; a status change is reported once; unanchored comments), TC-12 (oldest key first, the saved key stays, other store keys untouched), TC-13 review prompt exact text with a multi-line comment, 3 anchor groups and a status change.
  - Kit: TC-14 (a `comments` line then a `submit` line give 1 review prompt with the exact text, and `view.json` is written again with round 2 and the comment open and anchored); a submit with nothing new sends no prompt and toasts why.
  - Browser (Playwright Chromium, live `server.mjs` on the T03 real view model): Enter on a focused member opened the form with the focus in the text box (`Comment on member src/cart.ts#Cart#add(item: Item): void`); 3 drafts saved (member question, relation change request, whole review); counts `1 comment` on 2 anchors; "Submit review" showed `Review sent…`; the server printed 3 `comments` lines (the last with the 3 drafts) and 1 `submit` line.
  - Quality profile: QA-01 to QA-06 no hit; QA-07 only the known false matches (destructured object parameters) and throws inside test fakes.
- Validated state: base `8d5ddeb` plus the T01 to T06 diff; Windows 11, Chromium (Playwright), Node.js v24.20.0, kit on `terminal` and `desktop`.
- Open items:
  - Real session of the whole loop (comment on 6 anchor kinds in the browser, submit, the prompt in a live session, Claude answering without changing a file, rerun, mark resolved) is not run end to end; the parts are covered by the kit test (mod side) and the browser run (page and server side). It stays for the QA run and the T07 acceptance.
  - `web/app.js` has 619 lines (the 500-line reservation of QA-07 covers only the TypeScript files).
  - `isStatusChanged` is an optional field added to the TechSpec `Comment` shape, so a status change is reported once; old values without it read as unchanged.

### ADR candidates

None - direct TechSpec implementation or local decision.
