# Code review report — visual-review (prd-01-visual-review)

## Summary

- Status: REJECTED
- Execution: delegated reviewer
- Git scope: `8d5ddebde265db7378b7bb730671e34709905a23..worktree` (HEAD = base; all feature changes are uncommitted: `.claude-plugin/marketplace.json`, `README.md` and the untracked `visual-review/` folder)
- Previous review: `tasks/prd-01-visual-review/codereview_01/codereview.md`

The status comes only from the block that codereview_01 also recorded: T07.6 is partial and the essential manual acceptance (TC-18 network and lifetime parts, TC-19, live comment loop, desktop app, macOS/Linux, sample repositories) is open. The 11 findings of codereview_01 (CR-01 to CR-11) are all resolved. This review finds no new defect. The block needs the human (HIL 3) and QA. It does not need a correction round.

## Sources and scope

| Source | Path or reference | State |
| --- | --- | --- |
| PRD | `tasks/prd-01-visual-review/prd.md` | read (outcomes, FR, NFR); unchanged since 11:33, before codereview_01 |
| TechSpec | `tasks/prd-01-visual-review/techspec.md` | read (contracts, integrations, errors, test approach, quality profile, baseline); unchanged since 11:36 |
| Manifest | `tasks/prd-01-visual-review/tasks.md` | read; 7 links resolve to `done/task_01.md`–`done/task_07.md`; State: T01–T07 `[x]`, T07 with "T07.6 partial" |
| Corrections | `codereview_01/done/task_08.md`–`task_17.md` | read; 10 tasks, every Work item `[x]`, every handoff filled; traceability CR-01 to CR-11 (CR-05 and CR-06 in T13). The folder has no separate correction manifest; the task files carry the state |
| Decisions | `autonomous-decisions.md` (AUTO-14), `workflow.md` | read; AUTO-14 allows the optional fields `notice`, `anchors` (view model) and `sentStatus` (stored comment) |
| Snapshot | `context-snapshot.md` | loaded through the independent-stage filter: header, next step brief, open threads O-05, O-06, O-07, `on-run` entries L-03, L-08, L-10, L-11, L-12, L-14. Header valid: `git_head` 8d5ddeb = HEAD; worktree matches `git status --porcelain` (6 lines) |
| Implementation | `.claude-plugin/marketplace.json`, `README.md` (root), `visual-review/**` | delimited |
| Out of scope | `.gitignore` (context-brake block), `skills-lock.json` | pre-existing, not this feature (`workflow.md#Base and pre-existing changes`) |

## Coverage matrix

States of rows whose code the corrections did not touch reuse the codereview_01 evidence; the files `metrics.ts`, `paths.ts`, `host.ts`, `server.ts`, `review-text.js`, `style.css` and `index.html` have modification times before codereview_01 (13:58). Rows on changed paths were verified again in this review.

| Source | Obligation | Implementation | Test | State | Evidence |
| --- | --- | --- | --- | --- | --- |
| OBJ-01 | Every changed source file covered | `model.ts:checkModel` (297-318), `view.ts` other files | TC-05, TC-09 | conformant | Unchanged rule; O-03, O-05 stay informational |
| OBJ-02 | Review back in 1 action | `app.js` submit (715-731), `server.mjs` `/submit`, `register.tsx:submitReview` (223-243) | TC-14 | not verifiable | Kit tests pass; the live loop in a session is not run (O-06) |
| OBJ-03 | Comments traceable across rounds | `comments.ts:mergeComments` (98-119), `isPageBehind` (122-126), `register.tsx:saveComments` (211-217) | `comments.test.ts:62`, `visual-review.test.ts:444` | conformant | CR-02 resolved |
| OBJ-04 | Exact numbers | `git.ts:diffHunks` (189), `metrics.ts`, `view.ts:buildView` | TC-07, NFR-04, `git.test.ts:218` | conformant | CR-03 resolved; reproduced with `diff.mnemonicPrefix` and `diff.noprefix` |
| FR-01 | Command registered, manual only | `register.tsx` `COMMAND`, `session.start` (308-316) | TC-01 | conformant | No `immediate` |
| FR-02 | Default base, untracked files | `git.ts` | TC-02 | conformant | Unchanged by corrections except `diffHunks` |
| FR-03 | Base argument, invalid reference | `git.ts` | TC-03 | conformant | Reused |
| FR-04 | No repository or empty diff | `git.ts`, `register.tsx:323` | TC-03 | conformant | No prompt, no status |
| FR-05 | Subagent with configurable model | `register.tsx:303`, `prompts.ts` | TC-13, `visual-review.test.ts:240`, `prompts.test.ts:65` | conformant | CR-11 tests present |
| FR-06 | Coverage check and retry | `model.ts:checkModel`, `checkRanges` (343-369), `register.tsx:submitModel` (278-300) | TC-05, TC-06, 3 DEC-08 tests | conformant | Gaps name file or id |
| FR-07 | Unit kinds incl. module | `model.ts`, `view.ts` | TC-09 | conformant | Reused |
| FR-08 | Unit states incl. context | `view.ts`, `app.js`, `style.css` | TC-09 | conformant | Reused |
| FR-09 | Card fields | `view.ts`, `app.js` | TC-09 | conformant | Reused; O-12 informational |
| FR-10 | Line deltas from Git | `metrics.ts`, `git.ts:diffHunks` (186-189) | TC-07, `git.test.ts:218` | conformant | CR-03 resolved; nested units count twice (AUTO-09, known) |
| FR-11 | Ce and Ca | `metrics.ts` | TC-08 | conformant | File unchanged since 12:24 |
| FR-12 | Relation kinds and states | `app.js:relationLabel` (171-177), `mergedLabel` (183-204) | TC-09 (indirect) | conformant | CR-07 resolved: a merged label states each state in text |
| FR-13 | Tables and columns | `view.ts`, `app.js` | TC-09 | conformant | O-08 informational |
| FR-14 | Table sources per stack | `prompts.ts` | TC-13 | not verifiable | Live runs only on samples the session built (AUTO-13, O-05) |
| FR-15 | Table layer, entity links, filter | `view.ts`, `app.js:graphOf` | TC-09 | conformant | Reused (T05 manual) |
| FR-16 | Other files list | `view.ts`, `app.js` | TC-09 | conformant | Reused |
| FR-17 | Containers open and closed | `view.ts`, `app.js` | TC-10 | conformant | Reused |
| FR-18 | Comment anchors and types | `app.js`, `view.ts:anchorsOf` | TC-11 | conformant | CR-07 resolved: a merged label has no `data-anchor` and tells the reviewer to open the container (`app.js:183-204`); single relations keep their anchor. Manual check of all 6 anchor kinds stays in TC-19 |
| FR-19 | Review prompt | `prompts.ts:reviewPrompt` | TC-13 | conformant | Exact text test; CR-09 resolved |
| FR-20 | Submit waits; page confirms | `register.tsx:223-243`, `app.js:715-741` | `visual-review.test.ts:422, 460, 471` | conformant | CR-08 resolved: "Review sent." shows only on a higher round; a notice shows why nothing was sent |
| FR-21 | Open browser; tab updates | `register.tsx:openPage` | FR-21 DEC-02 kit test | conformant | O-07 informational |
| FR-22 | Comments by project and branch | `comments.ts:storeKey`, `mergeComments` | TC-11, `comments.test.ts:41, 62` | conformant | CR-02, CR-09 resolved |
| FR-23 | Unanchored list | `comments.ts:viewComments`, `app.js:withLocal` (484-513), `view.ts:anchorKeys` (196) | TC-11, `view.test.ts:144` | conformant | CR-10 resolved |
| FR-24 | Static fallback | `register.tsx:openStaticPage`, `server.ts`, `app.js:copyReview` | TC-17, FR-24 tests | conformant | T17 Chrome headless probe on the current code |
| FR-25 | Progress and failure | `register.tsx:startRun`, `endRun`, `turn.complete` | TC-15, `visual-review.test.ts:262` | conformant | Failed run leaves no state or status |
| NFR-01 | Loopback and token | `server.mjs:isToken` (77-81), Host check (188), POST token (130) | manual (this review) | conformant | CR-01 resolved; curl run in this review: 403 for 5 bad requests, 200 before and after |
| NFR-02 | Offline page | `server.mjs` CSP, `web/` | QA-06 | conformant | 0 network URL outside the vendored ELK file; network capture reused from T05 |
| NFR-03 | Supported API only | `register.tsx` call list of `claude plugin validate visual-review` | — | conformant | Call list holds only documented nouns; limitation L-2 on the types copy |
| NFR-04 | Determinism | `view.ts` (no clock in helpers, sorted keys) | NFR-04 test | conformant | `anchors` sorted (`view.test.ts:144`); `notice` null from `buildView` |
| NFR-05 | 100 units in 3 s | `app.js` draw | TC-19 (manual) | not verifiable | Playwright 1181 ms in T05; formal acceptance open (O-06) |
| NFR-06 | Server ends with the session | `register.tsx:stopServer`, `session.end` (361-366), `server.mjs:62` (exit on stdout error) | NFR-06 kit test | conformant | Real check in T04 reused (0 `node` after `/clear`) |
| NFR-07 | Accessibility | `app.js:mergedLabel` (`aria-label`, text states) | TC-19 (manual) | conformant | CR-07 resolved in code; keyboard and contrast evidence reused from T05; full manual script open (TC-19) |
| NFR-08 | Platforms and surfaces | `server.ts`, kit loops | TC-17, NFR-08 tests, TC-03 loop (`visual-review.test.ts:250`) | not verifiable | macOS/Linux and the desktop app not run (O-05) |
| NFR-09 | Store limit | `comments.ts` pruning | TC-12 | conformant | O-09 informational |
| NFR-10 | 1 analysis per run | `register.tsx:startRun` | FR-02 NFR-10 kit test | conformant | Reused |
| NFR-11 | English text | all files | review | conformant | New texts (`TOOL_MISSING_TEXT`, notices, merged label) in English |
| DEC-01 | Subagent + tool | `prompts.ts`, `register.tsx` | TC-06, TC-13 | conformant | — |
| DEC-02 | Node server, port 0, token | `server.mjs:70-71, 209` | FR-21 DEC-02 kit test | conformant | `listen(0, '127.0.0.1')` |
| DEC-03 | `view.json` + watch | `view.ts`, `server.mjs` | TC-06 | conformant | `notice.at` makes a repeated notice new content |
| DEC-04 | Comment lines to `$.store` | `register.tsx:enqueue` (191-195), `saveComments` | TC-14 (444) | conformant | CR-02 resolved |
| DEC-05 | Own cards + ELK 0.9.3 | `web/vendor/elk.bundled.js`, `ELK-LICENSE.md` | — | conformant | Reused |
| DEC-06 | Classic scripts; `view.js` | `index.html`, `server.ts` | FR-24 test | conformant | Reused |
| DEC-07 | Logic in helpers | `comments.ts:isPageBehind`, `view.ts:anchorKeys` | unit tests | conformant | New rules sit in helpers; the merged-label count stays in the page (drawing) |
| DEC-08 | Ranges and name check | `model.ts:checkRanges`, `baseText` (379-386), `missingBaseGap` (372-376); `register.tsx:287-289` | `model.test.ts` 3 DEC-08 tests | conformant | CR-04 resolved |
| DEC-09 | Model text in temp files | `view.ts`, README | — | conformant | — |
| DEC-10 | Command not immediate | `register.tsx` `COMMAND` | TC-01 | conformant | — |
| DEC-11 | Failure by `turnId` | `register.tsx:342-357` | TC-15 | conformant | — |
| CMP-01 | `register.tsx` contract | `register.tsx:308-339` | `visual-review.test.ts:250, 262, 309` | conformant | CR-05, CR-06 resolved |
| CMP-02–CMP-13 | Components | per TechSpec table | per TC | conformant | CMP-02 omits `status`, `toast`, `submit` (AUTO-08) |
| TC-01–TC-17 | Automated test cases | `tests/*.test.ts` | 109 tests | conformant | Every TC has at least 1 named test; CR-11 gaps closed |
| TC-18 | Manual security and lifetime | — | manual | not verifiable | Security part run in this review (403, 413, OPTIONS); network capture after T06 and `/clear` lifetime not run again |
| TC-19 | Manual page script | — | manual | not verifiable | Partial in T05, T15, T16 (Playwright) and T17 (Chrome headless); real stacks and a second browser not run |

## Compliance with rules and skills

| Rule or skill | State | Evidence |
| --- | --- | --- |
| `AGENTS.md` mod layout, Install section, marketplace row, root README row | OK | `visual-review/README.md`; `git diff --stat 8d5ddeb`: marketplace +5, README +1 |
| `AGENTS.md` supported API only | OK | `claude plugin validate visual-review` call list; no `@internal` member |
| `AGENTS.md` validate and test commands | OK | See Executed validations |
| `AGENTS.md` version bump | N/A | New, unreleased mod at `0.1.0`; no released version to bump from |
| `mod-hooks.md` failure model | OK | `command.run` clears the run inside the hook (`register.tsx:324-331`) and has `.catch` (334); `tool.call` `.catch` answers and never denies (337-339); observers end in `next(e)` |
| `mod-hooks.md` registration in `session.start` | OK | `register.tsx:308-316`; `isToolMissing` is a module-life flag set again by each registration (T13) |
| `mod-hooks.md` critical areas (store shape) | OK | `sentStatus` is optional and narrowed (`comments.ts:80`); old values still narrow (`comments.test.ts:53`) |
| `mod-runtime.md` no Node in hooks, no shell string | OK | QA-03, QA-05: 0 hits |
| `code-standards.md` helpers take `Host`, named limits | OK | QA-04: 0 hits; new helpers `isPageBehind`, `anchorKeys` are pure |
| `code-standards.md` sensitive data | OK | The token URL goes to a toast, not to the model (`register.tsx:296-297`); notices carry no prompt text |
| `javascript-typescript.md` no `any`, no floating promise | OK | QA-01: 0 hits; `tsc` exit 0; `startRun` timer chain ends in `.catch` |
| `tests.md` gating `.catch`, agent-facing text, settings, surfaces | OK | `visual-review.test.ts:240, 250 (terminal and desktop), 262, 309`; TC-01 asserts description and `inputSchema: SUBMIT_SCHEMA` (201); `prompts.test.ts:65` (`haiku`) |
| `pane-ui.md` status not only by color | OK | Merged label text `(+a −r =u)` (`app.js:188-195`) |

## Quality profile

| ID | Rule | Class | Command | Hits | State |
| --- | --- | --- | --- | --- | --- |
| QA-01 | No `any` | blocking | TechSpec command | 0 | OK |
| QA-02 | No empty `catch` | blocking | TechSpec command | 0 | OK |
| QA-03 | No shell string | blocking | TechSpec commands | 0 | OK |
| QA-04 | No `$` or `claude-code` in helpers | blocking | TechSpec command | 0 | OK |
| QA-05 | No `node:*`, `require`, `import()`, timers, `console` in hooks | blocking | TechSpec command | 0 | OK |
| QA-06 | Loopback only; no network in page | blocking | TechSpec commands | `listen(0, '127.0.0.1')` at `server.mjs:209` (expected); 6 `https?://` hits, all in `web/vendor/elk.bundled.js` (license and XML Schema IRIs) | OK. As in codereview_01, the `-g '!vendor/**'` glob does not exclude the vendor folder on this Windows run; 0 real hits |
| QA-07 | Throw in hook path, clock in helpers, 4+ parameters, files above 500 lines | reservation | TechSpec commands | throw: 7 regex hits, all kit or fake `Host` fakes in `tests/`; clock: 0; parameters: 8 regex hits, all destructured single objects or tuples, 0 functions with 4+ parameters; size: 0 `.ts` files above 500 lines | OK (0 real hits) |

- Terrain baseline: applied from TechSpec (marketplace.json and README.md: no profile rule applies; all other files are new).
- Hits discounted by baseline: 0.
- Reservations accumulated in the feature: 0 profile hits. `web/app.js` has 793 lines (open thread O-07): outside the `.ts` scope of the profile and under the 800-line escalation trigger.
- Suggested escalation: no trigger fired. If a later change makes `web/app.js` longer than 800 lines, the TechSpec trigger fires for that touched file.

## TechSpec adherence

| Decision or contract | State | Evidence |
| --- | --- | --- |
| Command contract | YES | `register.tsx` `COMMAND`, `command.run` (320-334) |
| Tool `submit_model` input and coverage rule | YES | `model.ts`; TC-01 asserts description and schema |
| `$.state.pendingRun` shape | YES | `types/index.d.ts` unchanged (11:55); T10 reads old paths from Git again instead |
| `$.store` key, version, narrowing, pruning | YES | Optional `sentStatus` (AUTO-14) narrowed and backward compatible; idempotency rule kept (`comments.ts:115-116`) |
| `userConfig.analysisModel` | YES | `plugin.json`, `prompts.ts`; option test through `register` |
| Server lines | PARTIAL | Extra `clients` and `tick` lines, covered by AUTO-10 |
| Integrations: `session.start` failed tool registration | YES | Toast and `isToolMissing` (`register.tsx:310-313`); command answers `TOOL_MISSING_TEXT` (321) |
| Integrations: `command.run` `.catch` clears `pendingRun` | YES | Cleared inside the hook (`register.tsx:326-330`); the `.catch` answers the cause (334) |
| Integrations: `tool.call` `.catch` never denies | YES | `register.tsx:337-339`; `visual-review.test.ts:309` |
| Flow step 1: `prompt.submit` from the hook | PARTIAL | `$.clock.after` because the engine refuses it inside `command.run` (AUTO-07) |
| Flow step 3: tool result has the URL | PARTIAL | URL goes to a toast, because it carries the token |
| Browser launch on Windows | PARTIAL | `rundll32 url.dll,FileProtocolHandler` (AUTO-10) |
| Git commands 1-6 | PARTIAL | Command 5 adds `--src-prefix=a/ --dst-prefix=b/` (CR-03 fix, inside the contract); command 6 reads the old path of a rename; `submitModel` runs command 4 again for renames; truncation of numstat and ls-files not handled (O-04) |
| Errors: a file that cannot be read in full skips the check | YES | `model.ts:382` (truncated or Git not run → unchecked); a base file missing at the base → gap (383); current-side read failure stays unchecked (T10 bound, `Host.readFile` limit) |
| Security: token, Host, 127.0.0.1, static path inside `web/` | YES | `server.mjs:77-81, 130, 188, 209`; curl run in this review |
| Body above 1 MiB: 413 | YES | 2 MB POST got 413 in this review (O-10 not reproduced) |
| File watch retries | YES | Reused |
| Comment shape | PARTIAL | Optional `isStatusChanged`, `sentStatus` added (T06, T12, AUTO-14) |
| View model | PARTIAL | Optional `notice` and `anchors` added (T15, T17, AUTO-14); DEC-07 keeps the logic in helpers |

## Verified tasks

| Task | Location | State | Handoff and evidence |
| --- | --- | --- | --- |
| T01 | `done/task_01.md` | COMPLETE | Command, base, files, error texts |
| T02 | `done/task_02.md` | COMPLETE | Analysis round trip; AUTO-07, AUTO-08 |
| T03 | `done/task_03.md` | COMPLETE | View model; AUTO-09 |
| T04 | `done/task_04.md` | COMPLETE | Server and browser; macOS/Linux unverified |
| T05 | `done/task_05.md` | COMPLETE with gap | Page checked on the T03 model, not on a real change with a deleted class and a migration |
| T06 | `done/task_06.md` | COMPLETE with gap | Live loop and keyboard-only comment flow not run |
| T07 | `done/task_07.md` | INCOMPLETE | T07.6 partial in the manifest: sample repositories need user approval (AUTO-13); desktop app and macOS/Linux not run |
| T08 | `codereview_01/done/task_08.md` | COMPLETE | CR-01; live server check 403, 403, 200; repeated in this review |
| T09 | `codereview_01/done/task_09.md` | COMPLETE | CR-03; forced prefixes; `git.test.ts:218`; repeated in this review |
| T10 | `codereview_01/done/task_10.md` | COMPLETE | CR-04; 2 new DEC-08 tests |
| T11 | `codereview_01/done/task_11.md` | COMPLETE | CR-02; `comments.test.ts:62`, `visual-review.test.ts:444` |
| T12 | `codereview_01/done/task_12.md` | COMPLETE | CR-09; `comments.test.ts:41, 53` |
| T13 | `codereview_01/done/task_13.md` | COMPLETE | CR-05, CR-06; `visual-review.test.ts:250, 262`. The handoff says the state-write test passes also through the `.catch` path, so it proves the answer, not which path gave it |
| T14 | `codereview_01/done/task_14.md` | COMPLETE | CR-11; 4 tests; mutant pass recorded |
| T15 | `codereview_01/done/task_15.md` | COMPLETE | CR-08; kit tests 422, 460, 471; Playwright check of the 3 page texts |
| T16 | `codereview_01/done/task_16.md` | COMPLETE | CR-07; Playwright check of the merged label |
| T17 | `codereview_01/done/task_17.md` | COMPLETE | CR-10; `view.test.ts:144`; Chrome headless probe of the static page |

## Executed validations

- Profile and scope: new mod `visual-review`; surfaces: command, deferred tool, status, toasts; no pane. Real-session checks per `.agents/rules/tests.md` were not run by this reviewer (contract: no real session that opens a browser).
- Validated state: worktree at HEAD 8d5ddeb plus the uncommitted feature changes after correction round 1 (last source write 14:14); Claude Code 2.1.308; Windows 11; Node.js v24.20.0; Git for Windows.
- Reused evidence: T04 (`/clear` leaves 0 `node`), T05 (Playwright timing 1181 ms, keyboard, themes, contrast), T15 and T16 (Playwright on the T01–T16 diff), T17 (Chrome headless on the current code). T17 changed `app.js` and `view.ts` after the T15 and T16 browser checks; T17 touched only `withLocal` and the `anchors` list, a separate path, so the T15 and T16 evidence stays valid for the submit texts and the merged label.
- Manual acceptance: open. TC-18 network capture after T06 and session-end lifetime, TC-19 on real stacks and a second browser, the full comment loop in a live session, the desktop app, macOS/Linux, and user approval of the sample repositories (O-05, O-06).

| Command | Result | Obligations covered |
| --- | --- | --- |
| `claude plugin validate .` | passed (exit 0) | CMP-13 |
| `claude plugin validate visual-review` | passed (exit 0); 1 directory warning ICON_MISSING (catalog only, no source obligation); gating hooks `command.run` and `tool.call` with `.catch` | CMP-12, NFR-03 |
| `claude plugin test visual-review` | passed: 109 pass, 0 fail, 8 files | TC-01–TC-17 |
| `tsc -p visual-review --noEmit` | passed (exit 0) | CMP-02, QA-01 |
| Quality profile script (TechSpec commands) | 0 real hits | QA-01–QA-07 |
| `git -c diff.mnemonicPrefix=true` and `git -c diff.noprefix=true` with `diff -U0 --no-color -M --src-prefix=a/ --dst-prefix=b/ 8d5ddeb -- README.md` | headers `--- a/README.md`, `+++ b/README.md` for both | CR-03, FR-10 |
| `node -e` with the `isToken` body and `?t=` of 64 `%C3%A9` | 64 characters; crafted → false, 64 `a` → false, right token → true; no throw | CR-01 |
| Live `server.mjs --dir <scratchpad> --web visual-review/web` with `curl` | no token 403; right token with `Host: localhost` 403; 64 `%C3%A9` 403; 64 `a` 403; right token 200; OPTIONS preflight 403; POST without token 403; POST of 2 MB with token 413; right token 200 after all; the server printed no `error` line. The probe server was stopped after the check (its stdout went to a file, so the EPIPE exit path did not apply) | NFR-01, TC-18 (security part), CR-01, O-10 |

## Findings

No new finding. The checks above and the reads of every corrected path found no defect that the sources support.

### Optional improvements

The optional improvements O-01 to O-12 of codereview_01 stay informational (AUTO-14). This review did not verify them again, except O-10: the 413 answer arrived in the curl check, so O-10 is not reproduced.

## Previous findings (re-review only)

| Review/ID | State | Current evidence |
| --- | --- | --- |
| codereview_01/CR-01 | resolved | `server/server.mjs:77-81` compares byte lengths before `timingSafeEqual`; `node -e` and live curl: crafted token 403, server alive, right token 200 |
| codereview_01/CR-02 | resolved | `hooks/comments.ts:116` drops an incoming draft whose id is already submitted; `isPageBehind` (122-126); `register.tsx:216` writes `view.json` again when the page is behind; `enqueue` (191-195) keeps later lines behind the submit. Tests `comments.test.ts:62`, `visual-review.test.ts:444` |
| codereview_01/CR-03 | resolved | `hooks/git.ts:189` forces `--src-prefix=a/ --dst-prefix=b/`; `git.test.ts:218`; reproduced on this repository with both prefix settings |
| codereview_01/CR-04 | resolved | `hooks/model.ts:379-386` reads the base at the old path and returns `isMissing` for a non-zero exit; `missingBaseGap` (372-376); `register.tsx:287-289` builds `oldPaths`; 2 new DEC-08 tests pass |
| codereview_01/CR-05 | resolved | `register.tsx:324-331` clears `pendingRun` and the status inside the hook; `startRun` builds the prompt before the state write (262-264); test `visual-review.test.ts:262` |
| codereview_01/CR-06 | resolved | `register.tsx:310-313, 321`; test `visual-review.test.ts:250` on terminal and desktop |
| codereview_01/CR-07 | resolved | `web/app.js:183-204, 273-278`: merged label text with state counts, no anchor, `aria-label` lists every relation; T16 Playwright check |
| codereview_01/CR-08 | resolved | `register.tsx:229-239` writes a notice; `web/app.js:715-741` shows "Review sent." only on a higher round; tests `visual-review.test.ts:422, 460, 471`; T15 Playwright check |
| codereview_01/CR-09 | resolved | `hooks/comments.ts:105-113` measures a change from `sentStatus`; `submitRecord` (134-144) clears it; tests `comments.test.ts:41, 53` |
| codereview_01/CR-10 | resolved | `web/app.js:484-513` checks restored drafts against `view.anchors`; `view.ts:180, 196`; test `view.test.ts:144`; T17 Chrome probe |
| codereview_01/CR-11 | resolved | `visual-review.test.ts:201` (`inputSchema: SUBMIT_SCHEMA`), 240 (`analysisModel: 'opus'`), 309 (`tool.call` `.catch`); `prompts.test.ts:65` (`haiku`); T14 mutant pass |

## Limitations and open items

- L-1 (block): T07 is incomplete (T07.6 partial), and the essential manual acceptance is open: TC-18 network capture after T06 and the session-end check, TC-19 on real stacks and a second browser, the live comment loop, the desktop app, macOS/Linux, and the user's approval of the sample repositories `shop-cs` and `shop-py` (AUTO-13). This reviewer did not run them (contract: no real session that opens a browser). The TechSpec routes manual acceptance to the QA report. This block alone makes the status `REJECTED`; it needs HIL 3 and QA, not a correction round.
- L-2: `visual-review/.claude-plugin/types/` is the copy from AUTO-06 (timestamp 12:03); the `validate` and `test` runs of this review did not rewrite it. The `tsc` result and the NFR-03 reading rest on that copy.
- L-3: The feature is uncommitted, so no Git diff separates the round-1 code from the corrections. This review verified each corrected path by reading it and by the suite; rows on files that did not change after codereview_01 (by modification time) reuse its evidence.
- L-4: The T15 and T16 browser evidence predates the T17 change to `app.js` and `view.ts`; T17 touched a separate path (`withLocal`, `anchors`).
- L-5: Open thread O-07: `web/app.js` has 793 lines, 7 under the 800-line escalation trigger.
- L-6: For `workflow.md` (not edited by this reviewer): record "codereview_02: REJECTED, delegated reviewer, 0 new findings, CR-01 to CR-11 resolved, 1 block (T07.6 and manual acceptance open, HIL 3)".

## Conclusion

REJECTED. Correction round 1 resolved all 11 findings of codereview_01 (CR-01 to CR-11), with code, tests and reproductions in this review. The automated checks pass: validate ×2, 109 tests, `tsc`, and the quality profile with 0 real hits. This review found no new defect. The status comes only from the block that codereview_01 also recorded: T07.6 is partial and the essential manual acceptance is open. Next step: HIL 3 for the sample repositories and the manual acceptance, then QA. A new correction round is not necessary.
