# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/prd.md`
2. `tasks/prd-01-visual-review/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T07 — Static fallback and acceptance

## Outcome

When `node --version` fails or the server exits before `ready`, the mod writes `view.js` and `review.html` in the temp folder and opens the static page; a toast says why. The static page draws the same diagram, keeps comments in browser storage, and "Copy review" copies the review text. The mod README is complete, and the real-session acceptance passes on a C#/EF Core, a TypeScript and a Python repository.

## Dependencies and boundaries

- Depends on: T06
- Unblocks: —
- In scope: static mode in `server.ts` and `register.tsx`, `view.js` and `review.html` writing, "Copy review" in the page, README sections (usage, settings, Node.js, ELK license, limits), the full manual script.
- Out of scope: new features; fixes found in acceptance go to `sdd-plan-corrections`.

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| OBJ-01 | `prd.md#outcomes-and-metrics` | Coverage on real repositories |
| FR-14, FR-24 | `prd.md#functional-requirements` | Table sources per stack; static fallback |
| NFR-08, NFR-11 | `prd.md#non-functional-requirements` | Platforms and surfaces; English text |
| DEC-06 | `techspec.md#technical-decisions` | Classic scripts and `view.js` |
| CMP-09, CMP-11, CMP-12 | `techspec.md#components-and-flow` | Static mode, page, README |
| TC-17 (static mode) | `techspec.md#test-approach` | Mode choice |

## Context to recover on demand

- Applicable skills and rules: `AGENTS.md` (README Install section, version bump, validation), `.agents/rules/mod-runtime.md` ("Files").
- Existing code: `visual-review/hooks/server.ts`, `visual-review/web/app.js`, `visual-review/README.md`.
- Contract or integration: `techspec.md#errors-security-and-recovery` (node missing), `prd.md#user-experience` (error texts).
- Engine reference: `$.process.run`, `$.fs.write`.

## Work

- [x] T07.1 `server.ts`: the mode choice from `node --version` and from a server that exits before `ready`.
- [x] T07.2 `register.tsx`: write `view.js` (`window.VIEW = …`) and `review.html` (file URLs to `web/app.js` and `elk.bundled.js` under `$.plugin.root`); open it; toast the reason.
- [x] T07.3 Page: detect static mode; keep comments in `localStorage` with try/catch; "Copy review" with the same text as the review prompt.
- [x] T07.4 Complete `visual-review/README.md`; check the root README row; set the tested Claude Code version.
- [x] T07.5 Extend `tests/server.test.ts` (TC-17 static mode) and the kit test for the fallback.
- [ ] T07.6 Run the full manual script on the 3 stacks, in the terminal and the desktop app.

## Acceptance criteria

- With `node` off the PATH, the static page opens and "Copy review" puts the review text in the clipboard.
- On each of the 3 repositories, every changed source file shows on the page (OBJ-01), and the migration tables show with their state.
- `/visual-review` works from the terminal and from the desktop app.

## Verification

- Unit: TC-17 static mode.
- Kit: the command flow chooses static mode when `node --version` fails.
- Real session: the full script on C#/EF Core, TypeScript and Python repositories; terminal and desktop app.
- Manual: the full script; owner: the developer; the user supplies or approves the sample repositories.
- Platforms: Windows verified; macOS and Linux recorded as unverified unless a machine is available.
- Commands: `claude plugin validate .`, `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Environment dependency: 3 sample repositories (open item in `tasks.md`); the desktop app.
- Expected evidence: test count and exit code 0; screenshots per stack; the copied text.

## Affected files

- Modify: `visual-review/hooks/server.ts`, `visual-review/hooks/register.tsx`, `visual-review/web/app.js`, `visual-review/README.md`, `visual-review/tests/server.test.ts`, `visual-review/tests/visual-review.test.ts`, `README.md`

## Observability and recovery

- Operational signal: the toast that names static mode and its reason.
- Recovery: install Node.js and run the command again.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: when no server runs for the session folder, the mod runs `node --version`; a run that fails, cannot start, or does not print `v<n>.<n>.<n>` gives static mode (`pageModeOf`). A server that ends before `ready` also gives static mode, with its cause. In static mode the mod writes `view.js` (`window.VIEW = <view.json>`) and `review.html` (the shipped `web/index.html` with each page file loaded by `file://` URL, no token, and `view.js` first) next to `view.json`, opens the file URL with the platform launcher, and toasts `visual-review: <cause>. The page is static: use Copy review to send the comments. Page: <file URL>`; the subagent gets `STATIC_RESULT`. The page detects `window.VIEW`: the button reads "Copy review", comments go to `localStorage` under `visual-review:<branch>:<base commit>` (every read and write in try/catch), a reload merges the saved drafts and statuses onto the view model's comments, and "Copy review" copies `reviewText({ baseLabel, drafts, changed })` from the new classic script `web/review-text.js` (clipboard API, else a selected text box and `execCommand('copy')`). `writeView` also returns the JSON it wrote. The 6 stale compiler outputs of T01 (`hooks/*.js`, `tests/*.js`) are deleted (AUTO-12). README: static page, Copy review, Node.js, platforms; the work-in-progress line is gone; tested on Claude Code 2.1.308 (`claude --version`).
- Changed files: created `visual-review/web/review-text.js`; modified `hooks/server.ts` (`PageMode`, `pageModeOf`, `staticPageOf`, `staticViewOf`, `writeStaticPage`, file name constants), `hooks/paths.ts` (`fileUrl`), `hooks/view.ts` (`writeView` returns `json`), `hooks/prompts.ts` (`STATIC_RESULT`, `NODE_MISSING_CAUSE`, `staticToast`; `serverFailedResult` removed), `hooks/register.tsx` (`openPage` returns a cause, `openStaticPage`), `web/app.js`, `web/index.html`, `tests/server.test.ts`, `tests/prompts.test.ts`, `tests/view.test.ts`, `tests/visual-review.test.ts`, `README.md`; deleted `hooks/git.js`, `hooks/host.js`, `hooks/paths.js`, `hooks/register.js`, `tests/git.test.js`, `tests/visual-review.test.js`. Root `README.md` row checked: unchanged.
- Checks:
  - `claude plugin validate .`: passed. `claude plugin validate visual-review`: passed (1 directory warning: no icon; gating hooks `command.run` and `tool.call` with `.catch`). `claude plugin test visual-review`: 94 pass, 0 fail (8 files). `tsc -p visual-review`: exit 0.
  - Unit: TC-17 page mode (version, no start, exit 1, another program), static page rewrite, file URL (drive, spaces, `#`, POSIX), `view.js`; FR-24 `reviewText` equals `reviewPrompt` on 3 inputs (every grouping case, 1 draft, only a status change).
  - Kit: TC-17 with no Node.js, `view.json`, `view.js`, `review.html` are written, only the opener starts with `file:///C:/Temp/claude-visual-review/s-1/review.html`, and the toast and result are exact; a server that ends before `ready` falls back to the static page and names the cause. The server-mode kit tests now answer `node --version`.
  - Real session, static (TypeScript sample `shop-ts`, terminal, headless stream-json, every PATH entry with `node` removed): toast `visual-review: Node.js not found. The page is static: use Copy review to send the comments. Page: file:///C:/Users/Admin/AppData/Local/Temp/claude-visual-review/<session>/review.html`; `review.html`, `view.js`, `view.json` written; the main loop answered that the page is ready as a static page.
  - Static page in Chrome 153 headless over `file://` (copy of the real `review.html` plus a probe script): `Drew 2 units and 0 tables`, button `Copy review`, a member comment through the form, 1 entry under `visual-review:main:<base>`, copied text equal to the review prompt format, `Review copied. Paste it in the Claude Code prompt.`; a second load of the same profile showed the saved draft again (2 comments sent). Playwright and claude-in-chrome refuse `file:` URLs, so this ran with Chrome's own `--headless --dump-dom`.
  - Server mode after the change (Playwright, live `server.mjs`): drew 2 units, `reviewText` loaded, no console warning.
  - Real session, server mode (terminal, headless): C#/EF Core sample `shop-cs` (5 changed files, all shown; units ShopContext, AddOrders, Customer, Order; table `Customers` modified with `Email` added, `Orders` added with 3 columns; 2 entity links; 0 gap rounds). Python sample `shop-py` with SQLAlchemy and Alembic (3 changed files, all shown; table `customers` modified with `name` modified, `orders` added; 2 entity links; 0 gap rounds). TypeScript server mode was run in T04 on `shop-ts`.
  - Quality profile over the task diff: QA-01 to QA-05 no hit; QA-06 only `listen(0, '127.0.0.1')`; QA-07 throws inside test fakes and the known false match on destructured object parameters (`writeStaticPage`).
- Validated state: base `8d5ddeb` plus the T01 to T07 diff; Windows 11, Claude Code 2.1.308, Node.js v24.20.0 (and none on the PATH for the static run), Chrome 153 and Playwright Chromium; kit on `terminal` and `desktop`.
- Open items:
  - T07.6 is not complete: the sample repositories were built by this session (AUTO-13) and still need the user's approval or the user's own repositories; the desktop app was not run; macOS and Linux are unverified. The real runs opened up to 3 browser tabs on this machine (1 static file page, 2 server pages that closed with their sessions).
  - The visual check TC-19 with real stacks (T05) and the full comment loop in a live session (T06) stay pending manual acceptance.
  - `web/app.js` has 721 lines (the 500-line reservation of QA-07 covers only the TypeScript files).
  - The static page keeps a restored draft's `isAnchored` as saved; a draft whose element left the model shows under "This round", not "Unanchored".

### ADR candidates

None - direct TechSpec implementation or local decision.
