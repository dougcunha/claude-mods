# Code review report — visual-review (prd-01-visual-review)

## Summary

- Status: REJECTED
- Execution: delegated reviewer
- Git scope: `8d5ddebde265db7378b7bb730671e34709905a23..worktree` (HEAD = base; all feature changes are uncommitted: 2 modified tracked files and the untracked `visual-review/` folder)
- Previous review: —

## Sources and scope

| Source | Path or reference | State |
| --- | --- | --- |
| PRD | `tasks/prd-01-visual-review/prd.md` | read |
| TechSpec | `tasks/prd-01-visual-review/techspec.md` | read |
| Manifest | `tasks/prd-01-visual-review/tasks.md` | read; 7 links resolve to `done/task_01.md`–`done/task_07.md`; State lists T01–T07 complete, T07 with T07.6 partial |
| Handoffs | `done/task_01.md`–`done/task_07.md`, `autonomous-decisions.md` (AUTO-01–AUTO-13), `workflow.md` | read (handoff detail through read-only explorers; AUTO decisions by question and choice) |
| Snapshot | `context-snapshot.md` | loaded through the independent-stage filter: header, next step brief, open threads O-05/O-06, `on-run` entries L-03, L-08, L-10, L-11, L-12, L-14. Header valid: `git_head` 8d5ddeb = HEAD; worktree matches `git status --porcelain` |
| Implementation | `.claude-plugin/marketplace.json`, `README.md` (root), `visual-review/**` (hooks, server, web, tests, manifest, README) | delimited |
| Out of scope | `.gitignore` (context-brake block), `skills-lock.json` | pre-existing, not this feature (`workflow.md#Base and pre-existing changes`) |

## Coverage matrix

| Source | Obligation | Implementation | Test | State | Evidence |
| --- | --- | --- | --- | --- | --- |
| OBJ-01 | Every changed source file covered | `hooks/model.ts:checkModel` (294-298), `hooks/view.ts:161-167` | TC-05, TC-09 | conformant | Coverage by unit file, table source or skipped file; see optional improvements O-03, O-05 |
| OBJ-02 | Review back in 1 action | `web/app.js:659-665`, `server/server.mjs:140-142`, `hooks/register.tsx:submitReview` | TC-14 | not verifiable | Kit test passes; the live loop in a session was not run (`done/task_06.md` handoff, O-06) |
| OBJ-03 | Comments traceable across rounds | `hooks/comments.ts:mergeComments`, `hooks/view.ts:235` | TC-11 | non-conformant | CR-02: a comment change during a waiting submit duplicates or loses comments |
| OBJ-04 | Exact numbers | `hooks/metrics.ts`, `hooks/view.ts:buildView` | TC-07, NFR-04 test | non-conformant | CR-03: under `diff.mnemonicPrefix` every unit delta is unknown |
| FR-01 | Command registered, manual only | `register.tsx:52-56, 276, 283` | TC-01 (terminal, desktop) | conformant | Exact spec, no `immediate` |
| FR-02 | Default base, untracked files | `hooks/git.ts:63-78, 90-96, 117-126` | TC-02 (5 tests) | conformant | origin/HEAD, main, master, merge-base; untracked counted |
| FR-03 | Base argument, invalid reference | `git.ts:80-87, 204` | TC-03, FR-03 tests | conformant | `rev-parse --verify --quiet <ref>^{commit}`; leading dash refused |
| FR-04 | No repository or empty diff | `git.ts:104, 110`, `register.tsx:285` | TC-03 | conformant | No prompt, no status |
| FR-05 | Subagent with configurable model | `register.tsx:272`, `hooks/prompts.ts:31-45` | TC-13 | conformant | Weak test: see CR-11 |
| FR-06 | Coverage check and retry | `model.ts:294-315`, `register.tsx:253-256` | TC-05, TC-06 | conformant | Gap names the file; see O-03 (context unit) |
| FR-07 | Unit kinds incl. module | `model.ts:10`, `view.ts:122` | TC-09 | conformant | Module unit test |
| FR-08 | Unit states incl. context | `view.ts:123`, `app.js:73, 81`, `style.css:213-217` | TC-09 | conformant | `ctx` badge, gray |
| FR-09 | Card fields | `view.ts:121-138`, `app.js:83-112` | TC-09 | conformant | All fields present on non-context cards |
| FR-10 | Line deltas from Git | `metrics.ts:32-53`, `git.ts:diffHunks` | TC-07 | non-conformant | CR-03; nested units count twice (known, AUTO-09) |
| FR-11 | Ce and Ca | `metrics.ts:63-75` | TC-08 | conformant | Live, distinct, no self, context included |
| FR-12 | Relation kinds and states | `view.ts:153`, `app.js:166-168, 236-244` | TC-09 (indirect) | non-conformant | CR-07: a merged edge label loses the state text |
| FR-13 | Tables and columns | `view.ts:154`, `app.js:116-139` | TC-09 (table ids only) | conformant | Column fields not asserted (O-08) |
| FR-14 | Table sources per stack | `prompts.ts:76` | TC-13 | not verifiable | Prompt names every source; live runs only for EF Core and SQLAlchemy/Alembic on session-built samples (AUTO-13, O-05) |
| FR-15 | Table layer, entity links, filter | `view.ts:112, 155`, `app.js:208-220, 251-257` | TC-09 | conformant | Filter checked manually in T05 (Playwright) |
| FR-16 | Other files list | `view.ts:161-167`, `app.js:361-371` | TC-09 | conformant | — |
| FR-17 | Containers open and closed | `view.ts:207-214`, `app.js:142-157` | TC-10 | conformant | `aria-expanded`, native button |
| FR-18 | Comment anchors and types | `app.js:72-139, 507-546, 599-616` | TC-11 | non-conformant | CR-07: a comment on a merged edge anchors to 1 of N relations; manual check covered 3 of 6 anchor kinds |
| FR-19 | Review prompt | `prompts.ts:162-177` | TC-13 | conformant | Text tells Claude to wait for confirmation; Claude's live behavior not verified |
| FR-20 | Submit waits; page confirms | `register.tsx:209`, `app.js:662-665` | TC-14 | non-conformant | CR-08: "Review sent" shows when nothing is sent or the prompt is dropped |
| FR-21 | Open browser; tab updates | `register.tsx:153-173` | FR-21 DEC-02 kit test | conformant | Rerun with a client opens no browser; see O-07 |
| FR-22 | Comments by project and branch | `comments.ts:45-49`, `view.ts:235` | TC-11 | non-conformant | CR-02 |
| FR-23 | Unanchored list | `comments.ts:113-116`, `view.ts:174-182` | TC-11 | non-conformant | CR-10 (static mode) |
| FR-24 | Static fallback | `register.tsx:164-183`, `hooks/server.ts:72-101`, `app.js:637-657` | TC-17, FR-24 tests | conformant | Clipboard checked by Chrome headless probe (T07) |
| FR-25 | Progress and failure | `register.tsx:219-247, 296-311` | TC-15 | conformant | — |
| NFR-01 | Loopback and token | `server.mjs:76, 125, 183-185, 204` | manual (T04) | non-conformant | CR-01: a crafted token crashes the server |
| NFR-02 | Offline page | `server.mjs:37-42` (CSP), `web/` | QA-06 | conformant | No external URL in `web/` outside the vendored file; TC-18 network panel recorded in T05 |
| NFR-03 | Supported API only | `register.tsx` calls listed by `claude plugin validate` | — | conformant | 0 `@internal` members used (explorer sweep of the types); limitation L-2 on the types copy |
| NFR-04 | Determinism | `view.ts` (no clock, sorted) | NFR-04 test | conformant | Same model and diff give the same JSON |
| NFR-05 | 100 units in 3 s | `app.js:374-403` | TC-19 (manual) | not verifiable | Playwright 1181 ms (T05); formal acceptance open (O-06) |
| NFR-06 | Server ends with the session | `register.tsx:88-92, 315-320`, `server.mjs:62, 210` | NFR-06 kit test | conformant | Real check in T04: 0 `node` after `/clear` |
| NFR-07 | Accessibility | `app.js:50-56, 238-244` | TC-19 (manual) | non-conformant | CR-07 |
| NFR-08 | Platforms and surfaces | `server.ts:104-119` | TC-17, NFR-08 tests | not verifiable | macOS/Linux launch and the desktop app not run (O-05) |
| NFR-09 | Store limit | `comments.ts:124-146` | TC-12 | conformant | Size counted in characters (O-09) |
| NFR-10 | 1 analysis per run | `register.tsx:240-246` | FR-02 NFR-10 kit test | conformant | — |
| NFR-11 | English text | all files | review | conformant | — |
| DEC-01 | Subagent + tool | `prompts.ts:42-81`, `register.tsx:59` | TC-06, TC-13 | conformant | — |
| DEC-02 | Node server, port 0, token | `server.mjs:68-70, 204-207` | FR-21 DEC-02 kit test | conformant | Adds `clients` and `tick` lines (AUTO-10) |
| DEC-03 | `view.json` + watch | `view.ts:236-239`, `server.mjs:167-179, 199-203` | TC-06 | conformant | 5 retries × 100 ms; no duplicate event |
| DEC-04 | Comment lines to `$.store` | `register.tsx:126-127, 186-197` | TC-14 | non-conformant | CR-02 |
| DEC-05 | Own cards + ELK 0.9.3 | `web/vendor/elk.bundled.js:1`, `ELK-LICENSE.md`, README:134 | — | conformant | — |
| DEC-06 | Classic scripts; `view.js` | `index.html:67-69`, `server.ts:80-101` | FR-24 view.js test | conformant | — |
| DEC-07 | Logic in helpers | `metrics.ts`, `view.ts`, `comments.ts` | TC-07–TC-12 | conformant | Edge merge stays in the page (`app.js:224-235`) |
| DEC-08 | Ranges and name check | `model.ts:321-367`, `metrics.ts:13-19` | DEC-08 tests | non-conformant | CR-04: base range of a renamed file is never checked |
| DEC-09 | Model text in temp files | `view.ts:236`, README:98 | — | conformant | — |
| DEC-10 | Command not immediate | `register.tsx:52-56` | TC-01 | conformant | — |
| DEC-11 | Failure by `turnId` | `register.tsx:296-311` | TC-15 | conformant | — |
| CMP-01 | `register.tsx` contract | `register.tsx:277, 288` | — | non-conformant | CR-05, CR-06 |
| CMP-02–CMP-13 | Components | per TechSpec table | per TC | conformant | CMP-02 omits `status`, `toast`, `submit` (AUTO-08) |
| TC-01–TC-17 | Automated test cases | `tests/*.test.ts` | 94 tests | conformant | Every TC-01–TC-17 has at least 1 named test; gaps in CR-11 |
| TC-18 | Manual security and lifetime | — | manual | not verifiable | 403 cases and `/clear` recorded in T04; 413 and OPTIONS not recorded after T06 added POST routes |
| TC-19 | Manual page script | — | manual | not verifiable | Partial in T05 (timing, keyboard, themes, contrast) on the T03 model, not on real stacks or a second browser |

## Compliance with rules and skills

| Rule or skill | State | Evidence |
| --- | --- | --- |
| `AGENTS.md` mod layout, Install section, marketplace row, root README row | OK | `visual-review/README.md:53`; `.claude-plugin/marketplace.json` diff; `README.md` diff |
| `AGENTS.md` supported API only | OK | `claude plugin validate visual-review` call list; no `@internal` member |
| `AGENTS.md` validate and test commands | OK | See Executed validations |
| `mod-hooks.md` failure model | NOT OK | Gating hooks have `.catch` (validate output). `command.run` `.catch` does not clear `pendingRun` as the TechSpec says (CR-05) |
| `mod-hooks.md` registration in `session.start` | OK | `register.tsx:275-280` |
| `mod-hooks.md` module values | OK | `pageServer` is a module value by TechSpec decision (`techspec.md#$.state`) |
| `mod-hooks.md` manifest | OK | `plugin.json`: version 0.1.0, `userConfig.analysisModel` with title, description, default, options |
| `mod-runtime.md` no Node in hooks, no shell string | OK | QA-03, QA-05: 0 hits |
| `mod-runtime.md` files under temp folder | OK | `paths.ts`, `view.ts:236` |
| `code-standards.md` helpers take `Host` | OK | QA-04: 0 hits |
| `code-standards.md` sensitive data | OK | Model text in temp files covered by DEC-09; toasts carry no prompt text |
| `javascript-typescript.md` no `any` | OK | QA-01: 0 hits; `tsc` exit 0 |
| `tests.md` agent-facing text and gating `.catch` scenarios | NOT OK | CR-11 |
| `pane-ui.md` status not only by color | NOT OK | CR-07 |

## Quality profile

| ID | Rule | Class | Command | Hits | State |
| --- | --- | --- | --- | --- | --- |
| QA-01 | No `any` | blocking | TechSpec command | 0 | OK |
| QA-02 | No empty `catch` | blocking | TechSpec command | 0 | OK |
| QA-03 | No shell string | blocking | TechSpec commands | 0 | OK |
| QA-04 | No `$` or `claude-code` in helpers | blocking | TechSpec command | 0 | OK |
| QA-05 | No `node:*`, `require`, `import()`, timers, `console` in hooks | blocking | TechSpec command | 0 | OK |
| QA-06 | Loopback only; no network in page | blocking | TechSpec commands | `listen(0, '127.0.0.1')` at `server.mjs:204` (expected); 6 `https?://` hits, all in `web/vendor/elk.bundled.js` (license and XML Schema IRIs) | OK. The `-g '!vendor/**'` glob does not exclude the vendor folder on this Windows run; 0 real hits |
| QA-07 | Throw in hook path, clock in helpers, 4+ parameters, files above 500 lines | reservation | TechSpec commands | throw: 5 regex hits, all kit fakes in `tests/`; clock: 0; parameters: 7 regex hits, all destructured objects or tuples, 0 functions with 4+ parameters; size: 0 `.ts` files above 500 | OK (0 real hits) |

- Terrain baseline: applied from TechSpec (marketplace.json and README.md: no profile rule applies; all other files are new).
- Hits discounted by baseline: 0.
- Reservations accumulated in the feature: 0 profile hits. `web/app.js` has 721 lines: outside the `.ts` profile scope and under the 800-line trigger.
- Suggested escalation: no trigger fired.

## TechSpec adherence

| Decision or contract | State | Evidence |
| --- | --- | --- |
| Command contract | YES | `register.tsx:52-56, 284` |
| Tool `submit_model` input and coverage rule | YES | `model.ts:5, 67-265, 294-298` |
| `$.state.pendingRun` shape | YES | `types/index.d.ts:2`, `register.tsx:234` |
| `$.store` key, version, narrowing, pruning | PARTIAL | `comments.ts:45, 55, 68, 124-146`; idempotency rule broken by CR-02 |
| `userConfig.analysisModel` | YES | `plugin.json:13-24`, `prompts.ts:12-17` |
| Server lines | PARTIAL | Extra `clients` and `tick` lines, covered by AUTO-10 |
| Integrations: `session.start` failed tool registration | NO | CR-06 |
| Integrations: `command.run` `.catch` clears `pendingRun` | NO | CR-05 |
| Integrations: `tool.call` `.catch` never denies | YES | `register.tsx:291-293` (no test, CR-11) |
| Flow step 1: `prompt.submit` from the hook | PARTIAL | `$.clock.after(0)` because the engine refuses it inside `command.run` (AUTO-07) |
| Flow step 3: tool result has the URL | PARTIAL | URL goes to a toast, not to the model, because it carries the token (`register.tsx:265`) |
| Browser launch on Windows | PARTIAL | `rundll32 url.dll,FileProtocolHandler` instead of `explorer.exe` (AUTO-10) |
| Git commands 1-6 | PARTIAL | Extra read-only `git diff --no-index` per untracked file; CR-03 on prefixes; truncation of numstat and ls-files not handled (O-04) |
| Security: token, Host, 127.0.0.1, static path inside `web/` | PARTIAL | All checks present before routing (`server.mjs:183-185, 91-95`); CR-01; the query token is accepted on every request, not only on `EventSource` (no bypass) |
| Body above 1 MiB: 413 | PARTIAL | `server.mjs:131-134` sends 413, then destroys the request at once (O-10) |
| File watch retries | YES | `server.mjs:167-179` |
| Comment shape | PARTIAL | `isStatusChanged` added (T06 handoff); CR-09 |

## Verified tasks

| Task | Location | State | Handoff and evidence |
| --- | --- | --- | --- |
| T01 | `done/task_01.md` | COMPLETE | Command, base, files, error texts; kit tests run on no surface loop except TC-01, though the Verification asks for terminal and desktop (O-11) |
| T02 | `done/task_02.md` | COMPLETE | Analysis round trip; AUTO-07, AUTO-08; same surface note |
| T03 | `done/task_03.md` | COMPLETE | View model; AUTO-09 (nested units counted twice) |
| T04 | `done/task_04.md` | COMPLETE | Server and browser; 403 checks and `/clear` recorded; macOS/Linux unverified |
| T05 | `done/task_05.md` | COMPLETE with gap | Page; Verification asks for a real change with an added, a modified and a deleted class plus a migration; the handoff used the T03 model (no deleted class, no table) |
| T06 | `done/task_06.md` | COMPLETE with gap | Comments and submit; live loop and keyboard-only comment flow not run; `style.css` fix after completion checked again in Chrome |
| T07 | `done/task_07.md` | INCOMPLETE | T07.6 partial in the manifest: sample repositories built by the session need user approval (AUTO-13); desktop app and macOS/Linux not run |

## Executed validations

- Profile and scope: new mod `visual-review`; surfaces: command, deferred tool, status, toasts; no pane. Real-session checks per `.agents/rules/tests.md` were not run by this reviewer (contract: no real session that opens a browser).
- Validated state: worktree at HEAD 8d5ddeb plus uncommitted feature changes; Claude Code 2.1.308; Windows 11; Node.js on the PATH; tsc 7.0.2.
- Reused evidence: manual results in the handoffs of T04 (403 checks, 0 `node` after `/clear`), T05 (Playwright timing 1181 ms, keyboard, themes, contrast) and T07 (Chrome headless probe of the static page). The T05 visual evidence predates the T06 `style.css` change; T06 records a new Chrome check after that change. None of this evidence covers the code paths of CR-01 to CR-10.
- Manual acceptance: open. TC-18 (413, OPTIONS, network capture after T06), TC-19 on real stacks and a second browser, the full comment loop in a live session, the desktop app, macOS/Linux, and user approval of the sample repositories (O-05, O-06).

| Command | Result | Obligations covered |
| --- | --- | --- |
| `claude plugin validate .` | passed (exit 0) | CMP-13 |
| `claude plugin validate visual-review` | passed (exit 0); 1 directory warning ICON_MISSING (catalog only, no source obligation); gating hooks `command.run` and `tool.call` with `.catch` | CMP-12, NFR-03 |
| `claude plugin test visual-review` | passed: 94 pass, 0 fail, 8 files | TC-01–TC-17 |
| `tsc -p visual-review --noEmit` | passed (exit 0) | CMP-02, QA-01 |
| Quality profile script (TechSpec commands) | 0 real hits | QA-01–QA-07 |
| `node -e` with `timingSafeEqual` on a 64-character `%C3%A9` token | throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` | CR-01 |
| `git -c diff.mnemonicPrefix=true diff -U0 8d5ddeb -- README.md` | headers `c/README.md`, `w/README.md` | CR-03 |

## Findings

| ID | Severity | Source | Evidence | Impact | Proven recommendation |
| --- | --- | --- | --- | --- | --- |
| CR-01 | Medium | NFR-01, DEC-02 | `server/server.mjs:76` — `isToken` compares `value.length` (UTF-16 characters) with `token.length`, then calls `timingSafeEqual(Buffer.from(value), tokenBytes)`. A `?t=` of 64 `%C3%A9` has 64 characters and 128 bytes, so `timingSafeEqual` throws (reproduced with `node -e`). The throw is uncaught in the request handler; `server.mjs:62-65` prints `error` and calls `process.exit(1)`. The Host check at `:183` passes for any request to `127.0.0.1:<port>`, for example an `<img>` on any web page | Any page in the user's browser that finds the port stops the review server; Submit review then fails until the next run | Compare byte lengths: `const bytes = Buffer.from(value); bytes.length === tokenBytes.length && timingSafeEqual(bytes, tokenBytes)`, and add a manual or unit check with a non-ASCII token |
| CR-02 | Medium | FR-22, OBJ-03, DEC-04, TechSpec "Concurrency and idempotency" | `hooks/comments.ts:78-92` and `hooks/register.tsx:126-127, 203-216`. `submitReview` waits in `$.prompt.submit` until the session is idle; the queue holds later `comments` lines. The page still shows the sent drafts as `draft` until `view.json` is written again, so a comment change in that time posts them again. After `submitRecord`, `mergeComments` keeps comment X as `open` and adds X again as a draft with the same id. The `view.json` write at `:215` happens before that merge, so the page then shows a set without the new draft Y, and the next page save removes Y from the store | Duplicate comments with 1 id, or a lost new comment, after a submit while Claude is busy | In `mergeComments`, drop an incoming draft whose id already exists as a non-draft comment, and write `view.json` again after each saved `comments` line that follows a submit; add a TC-14 case with a `comments` line between `submit` and the prompt entry |
| CR-03 | Medium | FR-10, DEC-08, OBJ-04 | `hooks/git.ts:186` runs `git diff -U0` with no `--src-prefix`/`--dst-prefix`; `git.ts:148-151` strips only `a/` or `b/`. With the user setting `diff.mnemonicPrefix=true` the headers are `c/<path>` and `w/<path>` (reproduced), so no hunk key matches a numstat path. With `diff.noprefix=true` a real path that starts with `a/` or `b/` loses that folder | Every unit delta shows as unknown, with no warning, for users with that Git setting | Pass `--src-prefix=a/ --dst-prefix=b/` (or `--no-prefix` and remove the strip) in `diffHunks`, and add a parser test for the chosen form |
| CR-04 | Medium | DEC-08 | `hooks/model.ts:340, 345-352, 362-366` — `baseText` runs `git show <base>:<unit.file>` with the new path. For a renamed file this fails, so `baseRange` (and the range of a deleted unit in a renamed file) is never checked and the unit goes to `unchecked`; any other read failure also goes to `unchecked`, though the TechSpec skips the check only for files above 4 MiB. The card then says the file was too large or missing (`web/app.js:112`) | A wrong base range on a renamed file passes, and the unit delta of a renamed, modified unit can be wrong with no gap sent back | Keep the old path of a renamed file (`ChangedFile.oldPath`) in `pendingRun.files` or look it up again, use it for the base side, and return a gap (not `unchecked`) when the file is missing; add a DEC-08 test for a rename |
| CR-05 | Low | TechSpec integrations table (`command.run`) | `hooks/register.tsx:288` — the `.catch` answers `{ text }` only. If a call after `update($, pendingRun, () => run)` at `:235` throws (for example `$.ui.status` at `:236`), `pendingRun` and the status stay set with no prompt and no `analysisTurnId`, so `turn.complete` cannot clear them | A stuck "Analyzing" status until the next run or `/clear` | Clear the run inside the hook with a `try`/`catch` around `startRun` (a `.catch` handler cannot call `$` on a re-entry, `mod-hooks.md`), or record the narrower contract in the TechSpec |
| CR-06 | Low | TechSpec integrations table (`session.start`) | `hooks/register.tsx:277` shows a toast when `$.tool.register` fails; `command.run` (`:283-288`) never checks that the tool exists and still submits the analysis prompt | The subagent cannot send the model; the run ends with "no model" instead of "the tool is missing" | Keep a registration flag for the module life and answer the command with the missing-tool text when it is false |
| CR-07 | Low | NFR-07, FR-12, FR-18, `pane-ui.md` | `web/app.js:238-244` — a merged edge (closed container, or several relations with the same ends and kind) gets the text `<kind> · N relations`; its state shows only through the CSS class of the first relation, and its `aria-label` and `data-id` name only the first relation | State shown only by color on merged edges; a comment on that label anchors to 1 of N relations | Put the states in the merged label text (for example `+1 −1`) and list the relations in the label, or open a chooser for the anchor |
| CR-08 | Low | FR-20, PRD UX step 6 | `web/app.js:662-665` shows "Review sent" on any 2xx of `POST /submit`; the mod can then send nothing (`register.tsx:208`) or have the prompt dropped (`:210`), which only a CLI toast reports | The page says the review was sent when it was not | Report the outcome back to the page (for example a `sent` or `dropped` field in the next `view.json`) or word the page text as "Review handed to the session" |
| CR-09 | Low | TechSpec review prompt ("status changes of older comments"), AUTO-11 | `hooks/comments.ts:84-88` — a comment that goes open → resolved → open before a submit keeps `isStatusChanged: true`, so the review prompt reports "Open again" for a comment that did not change. The static page compares with `shownStatus` (`app.js:642-644`) and reports nothing, so the 2 texts differ | A false status change in the review prompt | Set `isStatusChanged` only when the new status differs from the status at the last submit |
| CR-10 | Low | FR-23 | `web/app.js:460-468` — in static mode a saved draft comes back with its old `isAnchored`, so a draft on an element that is gone from the new model shows under "This round", not "Unanchored" (recorded in the T07 handoff) | Wrong list in static mode | Recompute `isAnchored` against the new view for restored drafts |
| CR-11 | Low | `tests.md` (Required scenarios: gating `.catch`, agent-facing text, settings) | `tests/visual-review.test.ts`: no test drives the `tool.call` `.catch` (`register.tsx:291-293`); no kit test passes `options.analysisModel` through `register`; TC-01 asserts only the tool `name` and `isDeferred`, not its description or `inputSchema`; `haiku` is never put through `analysisPrompt` | A regression in these paths passes the suite | Add the 4 tests |

### Optional improvements

- O-01: `hooks/model.ts:322-324` — `split(/\r?\n/)` counts the empty item after a final newline, so `end` may be 1 past the last line (the DEC-08 test accepts it).
- O-02: `hooks/view.ts:156-160` — the `rest` delta of each file is built but `web/app.js` never shows it, so the reviewer cannot reconcile cards with the file total (FR-10 second clause).
- O-03: `hooks/model.ts:296` — a `context` unit covers a changed source file, which skips its range, summary and cohesion.
- O-04: `hooks/git.ts:118-125` — `isStdoutTruncated` is ignored for `--numstat -z` and `ls-files -z`.
- O-05: `hooks/view.ts:231` lists the files again at tool time while coverage used `pendingRun.files`; a file changed in between can disappear from the page.
- O-06: tracked files with no `-U0` hunks (pure rename) show "delta unknown" instead of +0/−0.
- O-07: `register.tsx:157` — a rerun before the first tab's `EventSource` connects opens a second tab.
- O-08: TC-09 does not assert relation fields or column fields.
- O-09: `comments.ts:143` counts JSON size in characters, not bytes.
- O-10: `server.mjs:131-134` — `request.destroy()` right after `send(413)` can reset the socket before the 413 arrives (not reproduced).
- O-11: TC-03, TC-06 and TC-15 run on no surface loop; T01/T02 Verification asks for terminal and desktop.
- O-12: the cohesion reason is a `title` on a non-focusable element (`app.js:90-92`), so a keyboard user cannot read it.

## Previous findings (re-review only)

- Not applicable: first review.

## Limitations and open items

- L-1: Manual acceptance not run by this reviewer (contract: no real session, no browser). The TechSpec routes manual acceptance to the QA report. This review reads the open manual items as open for QA, not as findings; they still prevent `APPROVED` because T07 is incomplete and TC-18/TC-19 are partial.
- L-2: `visual-review/.claude-plugin/types/` is a copy of the session-info engine types plus a hand-written `claude-code-mcp/index.d.ts` (AUTO-06); the engine did not lay it, and this review's `validate` and `test` runs did not rewrite it (timestamp 12:08). The `tsc` result and the NFR-03 sweep rest on that copy.
- L-3: Handoff detail and the matrix slices for page and server code came from 3 read-only explorers; this reviewer verified the evidence of CR-01 to CR-10 directly (`path:line` reads and 2 commands). A slice without findings is not read as approval.
- L-4: CR-02 is proven by code reading, not by a reproduction.
- L-5: Open items for the human: O-05 (sample repositories built by the session need approval, desktop app, macOS/Linux), O-06 (TC-19 with real stacks and a second browser, live comment loop). For `workflow.md` (not edited by this reviewer): record "codereview_01: REJECTED, delegated reviewer, 11 findings (4 Medium, 7 Low)".

## Conclusion

REJECTED. The automated checks pass (validate ×2, 94 tests, tsc, quality profile with 0 real hits), and most obligations are conformant. The review still finds 4 Medium defects: a crafted token stops the page server (CR-01), comments duplicate or get lost after a submit while Claude is busy (CR-02), a common Git setting makes every unit delta unknown (CR-03), and the base range of a renamed file is never checked (CR-04). It also finds 7 Low defects against TechSpec contracts, accessibility and test rules. T07 is incomplete (T07.6), and the essential manual acceptance is open. Next step: `sdd-plan-corrections` for CR-01 to CR-11, then a new delegated review.
