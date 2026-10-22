# QA report — visual-review (prd-01-visual-review)

## Summary

- Status: BLOCKED
- Execution: delegated QA runner
- Code state: base `8d5ddebde265db7378b7bb730671e34709905a23` (`main`) plus the uncommitted diff: `.claude-plugin/marketplace.json`, `README.md` (3 files changed, 19 insertions, with the pre-existing `.gitignore`), and 31 untracked files under `visual-review/`. The worktree was the same before and after this run, except for `qa_01/`.
- Latest review: `codereview_02/codereview.md` (REJECTED only by the open manual-acceptance block; `workflow.md` W-05 closes the review cycle with that block accepted as open manual acceptance for HIL 3)
- Previous QA: —
- Snapshot: loaded through `.agents/skills/sdd-snapshot/references/load.md` with the independent-stage filter (header, next step brief, open threads, `on-run` entries only). Its `next_step` is behind `workflow.md` (W-05 is already answered). This does not change QA.

## Environment

| Item | Value |
| --- | --- |
| Claude Code | 2.1.308 (Claude Code) |
| Mod version | 0.1.0 (`visual-review/.claude-plugin/plugin.json`) |
| Platforms | Windows 11 Pro 10.0.26200, terminal surface, headless `claude -p` with stream-json. Node.js v24.20.0, Git 2.56.0.windows.2. Not run: desktop app, macOS, Linux. |
| Validation commands | `claude plugin validate .`: passed, exit 0. `claude plugin validate visual-review`: passed, exit 0 (1 plugin-directory warning about hooks modules, not a repository rule). `claude plugin test visual-review`: 109 pass, 0 fail, 8 files, exit 0. `tsc -p visual-review`: exit 0. |
| Working directory | `C:\Users\Admin\AppData\Local\Temp\claude\D--MyProjects-claude-mods\f6f231e4-6f13-40a7-857b-a19131c68a8c\scratchpad\qa01` (copies of `shop-ts`, `shop-cs`, `shop-py` under `repos/`, a non-Git folder `nogit/`, a clean repository `clean/`) |
| Mod load | `--plugin-dir D:/MyProjects/claude-mods/visual-review`. `visual-review@claude-mods` is installed at local scope for the repository folder only; the init plugin list of the runs (outside the repository) shows `visual-review` 1 time. `session-info@claude-mods` (user scope) loads in every run; it does not touch this mod. |
| Mod writes | `evidence/fs-write-folders.txt`: every `$.fs.write` of the 3 analysis sessions is under `<TEMP>/claude-visual-review/<session id>/`; the sample copies and the worktree are unchanged by the mod |
| Run pattern | `qa01/session.sh <name> <repo> [static]`: stream-json input, `Reply with OK only.` first, then `/visual-review` as a later message; `--allowedTools "Agent,Read,Grep,Glob,ToolSearch,Bash(git diff:*),Bash(git status:*),Bash(git show:*),Bash(git log:*),mcp__visual-review__submit_model"`; `--debug-file`. |

Evidence files are in `qa_01/evidence/`. Tokens are removed from saved text.

## Acceptance checklist

| Obligation | Test cases | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| FR-01 Command, manual only | TC-01 | kit + real-session | PASSED | `plugin-test.txt`; `/visual-review` ran only when sent, in all 5 sessions (`*-session-results.txt`) |
| FR-02 Default base, untracked files as added | TC-02 | unit + real-session | PASSED | `ts-run1-view-summary.txt`: base `main`; untracked `src/cart.ts`, `src/pricing.ts`, `db/001_orders.sql` show as added |
| FR-03 Base argument, invalid reference | TC-03 | kit + real-session | PASSED (invalid reference real; `HEAD~1` by kit only) | `ts-session-results.txt`: `visual-review: Unknown Git reference: nope.`, no analysis turn |
| FR-04 No repository, empty diff | TC-03 | kit + real-session | PASSED | `nogit-session-results.txt`: `visual-review needs a Git repository.`; `clean-session-results.txt`: `No changes against main.`; 2 results only, 0 server spawns |
| FR-05 Subagent with configurable model | TC-13 | unit + real-session | PASSED (default real; setting change by unit only) | `ts-session-results.txt`: 1 `Agent` call per run with `model: sonnet`; the subagent loaded the tool with ToolSearch. Change of `analysisModel`: TC-13 only (see limitations) |
| FR-06 Coverage check and retry | TC-05, TC-06 | unit + kit + real-session | PASSED | 4 real runs: model accepted at the first `submit_model` call, 0 gap results; gap path in TC-05, TC-06 (`plugin-test.txt`) |
| FR-07 Unit kinds incl. module | TC-09 | unit + real-session | PASSED | `ts-run1-view-summary.txt`: `src/pricing` kind `module` (file with only exported functions) |
| FR-08 Unit states incl. context | TC-09 | unit + real-session | PASSED | added/modified in all runs; context `shop.models.Base` in `py-numstat-check.txt`; deleted state by TC-09 only |
| FR-09 Card fields | TC-09, TC-19 | unit + real-session + page | PASSED | every non-context unit in `*-view-summary.txt` has lines, deltas, methods, members, summary, cohesion, Ce, Ca |
| FR-10 Line deltas from Git | TC-07 | unit + real-session | PASSED | `src/cart.ts` 11 + rest 2 = 13 (run 2: 8 + 2 = 10); `src/item.ts` 4; `shop/models.py` units +2/−1, +7/−0, rest +4/−2 = numstat 13/3 (`py-numstat-check.txt`) |
| FR-11 Ce and Ca | TC-08 | unit + real-session | PASSED | `ts-run1-view-summary.txt`: `Item` Ca 2 = 2 arrows (composition, dependency); `Cart` Ce 1 |
| FR-12 Relation kinds and states | TC-09 | unit + real-session | PASSED (added real; removed by unit only) | composition and dependency, state added (`ts-run1-view-summary.txt`) |
| FR-13 Tables and columns | TC-09 | unit + real-session | PASSED | `cs-view-summary.txt`: EF Core migration, `Customers` modified, `Email` added; `Orders` added, `CustomerId` → `Customers.Id` |
| FR-14 Table sources per stack | TC-13 | real-session + unit | NOT VERIFIABLE (partial) | Real: `.sql` (`ts`), EF Core migration and `DbContext` (`cs`), SQLAlchemy and Alembic (`py`). Prisma, TypeORM, Drizzle and Django migrations not run (no sample) |
| FR-15 Table layer, entity links, filter | TC-09, TC-19 | unit + real-session + page | PASSED | links in `cs-view-summary.txt`, `py-view-summary.txt`; filter without reload in `page-checks.txt` |
| FR-16 Other files | TC-09 | unit + real-session | PASSED | `README.md` in "Other files" (`ts-run1-view-summary.txt`, `cs-view-summary.txt`) |
| FR-17 Containers open and closed | TC-10, TC-19 | unit + page | PASSED | `page-checks.txt`: Enter on a header closes it, `aria-expanded` follows, focus stays |
| FR-18 Comment anchors and types | TC-11, TC-19 | unit + real-session + page | NOT VERIFIABLE (partial) | 6 anchor kinds stored (`ts-after-submit-view-summary.txt`); keyboard form on a member (`page-checks.txt`). Not run: clicks on each anchor kind by hand, and a visual check that the comment shows next to its anchor |
| FR-19 Review prompt | TC-13 | unit + real-session | PASSED | `ts-review-turn.txt`: Claude answered the 3 questions, gave a plan for the 3 change requests, used no tool, and said it changed no file; repository unchanged after the turn |
| FR-20 Submit waits for idle; page confirms | TC-14 | kit + real-session | PASSED (idle real; busy session by kit only) | `ts-submit-http.txt`: `POST /submit` 202 `Review sent`; prompt ran as the next turn |
| FR-21 Browser opens; tab updates | TC-17, TC-19 | unit + real-session | PASSED | `ts-session-results.txt`: run 1 `Visual review ready`, run 2 `Visual review updated in the open tab`; `ts-server-processes-during.txt`: 1 server process and 1 browser launch over the 2 runs |
| FR-22 Comments by project and branch, status | TC-11 | unit + real-session | PASSED | rerun shows the 6 comments `open`, round 1; status `resolved` kept after a submit (`ts-run2-view-summary.txt`, `ts-resolve.txt`) |
| FR-23 Unanchored list | TC-11 | unit + real-session | PASSED | comment on deleted member `Cart#total(): number` has `anchored=false` after the rerun (`ts-run2-view-summary.txt`) |
| FR-24 Static fallback, Copy review | TC-17 | kit + real-session | NOT VERIFIABLE (partial) | `cs-static-session-results.txt`: no `node` on PATH, toast `Node.js not found. The page is static: use Copy review to send the comments.`, `review.html`, `view.js`, `view.json` written, 0 server spawns. Clipboard copy in a browser: not run |
| FR-25 Progress and failure | TC-15 | kit + real-session | PASSED (progress real; failure by kit only) | status `Analyzing the design of the change…` set 1 time per run (`ts-session-results.txt`); failure path TC-15 |
| NFR-01 Loopback and token | TC-18 | real-session | PASSED | `nfr01-token-checks.txt`: no token 403, wrong token 403, header token 200, wrong `Host` 403, `localhost` Host 403, POST without token 403, preflight 403; listener `127.0.0.1` only |
| NFR-02 Offline page | TC-18, QA-06 | page | PASSED (tool browser) | `page-checks.txt`: 7 requests, all `127.0.0.1` |
| NFR-03 Supported API only | review | review | PASSED (review evidence) | `codereview_02/codereview.md` NFR-03 row; `validate-mod.txt` |
| NFR-04 Determinism | TC-07 | unit | PASSED | `plugin-test.txt` (TC-07) |
| NFR-05 100 units in 3 s | TC-19 | page | PASSED | `page-checks.txt`: drawn in 885 ms after DOMContentLoaded at 191 ms |
| NFR-06 Server ends with session | TC-18 | real-session | PASSED | `nfr06-after-exit.txt`: 0 `server.mjs` node processes and 0 listeners after exit; same for the Python run (`py-session-results.txt`) |
| NFR-07 Accessibility | TC-19 | page + manual | NOT VERIFIABLE (partial) | badges and keyboard in `page-checks.txt`; dark theme screenshot `page-100-units-dark.png`. Contrast not measured again; full keyboard walk by a person not run |
| NFR-08 Platforms and surfaces | TC-17 | real-session + manual | NOT VERIFIABLE | Windows terminal only. Desktop app, macOS, Linux not run |
| NFR-09 Store limit | TC-12 | unit | PASSED | `plugin-test.txt` (TC-12) |
| NFR-10 1 analysis per run | TC-01, TC-06 | real-session | PASSED | `ts-session-results.txt`: 2 runs, 2 `Agent` calls, 2 `submit_model` calls; 0 analyses without the command |
| NFR-11 English text | review | real-session + review | PASSED | all mod toasts and command answers in English (`*-session-results.txt`). The main-loop answers are in Portuguese because of the user's global instructions, not the mod |
| OBJ-01 to OBJ-04 | TC-05, TC-07, TC-09, TC-11, TC-14 | derived | PASSED for the routes above | every changed file of the 3 samples shows as a unit, table or "Other files" row |

## Real-session runs

| Scenario | Surface | Command | Exit code | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| Invalid reference, TS analysis, comments, submit, rerun, status change, session end | headless terminal | `session.sh ts repos/shop-ts` (`/visual-review nope`, `/visual-review`, POSTs, `/visual-review`, POST, stop) | 0 | PASSED | `ts-session-results.txt`, `ts-run1-view.json`, `ts-review-turn.txt`, `ts-run2-view-summary.txt`, `ts-resolve.txt`, `nfr01-token-checks.txt`, `nfr06-after-exit.txt` |
| Not a Git repository | headless terminal | `session.sh nogit nogit` | 0 | PASSED | `nogit-session-results.txt` |
| Empty diff | headless terminal | `session.sh clean clean` | 0 | PASSED | `clean-session-results.txt` |
| C# / EF Core, static mode (no `node` on PATH) | headless terminal | `session.sh cs repos/shop-cs static` | 0 | PASSED | `cs-static-session-results.txt`, `cs-view-summary.txt` |
| Python / SQLAlchemy + Alembic, server mode | headless terminal | `session.sh py repos/shop-py` | 0 | PASSED | `py-session-results.txt`, `py-view-summary.txt`, `py-numstat-check.txt` |
| Page with the 100-unit fixture | Playwright Chromium | `node visual-review/server/server.mjs --dir qa01/page --web visual-review/web` | stopped by QA | PASSED | `page-checks.txt`, `page-100-units-dark.png` |

The TS run posted comments with `curl` to the live server in place of clicks, with the token header and the correct `Host`. The page form itself ran in the fixture check. The real runs opened 2 tabs in the default browser on this machine (TS and Python server pages); the static run opened 1 `file://` page.

## Manual acceptance

| Script | Executed by | Observed result | Status |
| --- | --- | --- | --- |
| TC-19 visual check with real C#, TypeScript and Python changes in the person's browser and 1 other browser | — | not run: needs the user | NOT VERIFIABLE |
| Full comment loop by hand in the page (clicks on each anchor kind, Submit review button, "Review sent" text, Copy review in the static page) | — | the server and mod side ran with `curl`; the hand-driven page did not run | NOT VERIFIABLE |
| Desktop app of Claude Code | — | not run: needs the user | NOT VERIFIABLE |
| macOS and Linux (browser launch, server) | — | no machine | NOT VERIFIABLE |
| User approval of the sample repositories `shop-cs`, `shop-py`, `shop-ts` (AUTO-13) | — | not given; QA used copies of the session-built samples | NOT VERIFIABLE |
| TC-18 network panel and session end | delegated QA runner | only `127.0.0.1` requests (tool browser); 0 server processes after exit | PASSED |

## Findings

No `BUG-NN`. No run gave a result different from the PRD or the TechSpec.

## Limitations and open items

- Block (HIL 3, W-05): the essential manual acceptance needs the user. Affected: FR-18 and FR-24 (hand-driven page, clipboard), NFR-07 (full keyboard walk, contrast), NFR-08 (desktop app, macOS, Linux), TC-19 on real stacks with a second browser, and the approval of the sample repositories.
- FR-14: no sample for Prisma, TypeORM, Drizzle or Django migrations. Only the analysis prompt text covers them (TC-13).
- FR-05: QA did not change `analysisModel`. A change needs the user's settings, which the contract forbids. The real run shows the default `sonnet`; TC-13 covers the option.
- FR-03 `HEAD~1`, FR-08 deleted state, FR-12 removed relation, FR-20 busy session and FR-25 failure toast are proven by unit and kit tests only.
- The page checks used the Playwright tool browser (Chromium), not the user's own browser. The `.playwright-mcp/` folder was removed.
- The samples were built by an earlier session (AUTO-13) and are not approved by the user. QA added 3 files to its own copy of `shop-ts` (`src/pricing.ts`, `db/001_orders.sql`, `README.md`) and deleted `Cart.total()` before the rerun. The originals are unchanged.
- The main loop answered in Portuguese because of the user's global instructions. The mod text is in English.

## Conclusion

BLOCKED. The automated checks pass: validate 2 times, 109 kit and unit tests, and `tsc`. Five real headless sessions on Windows confirm the command, the error cases, the analysis round trip on TypeScript, C# and Python, the Git line numbers, Ce and Ca, the tables, the static fallback, the token and `Host` protection, the comment round trip with submit, rerun, the unanchored list, a status change, and the server stop at session end. The 100-unit page draws in less than 1 s, works by keyboard, and loads only local resources. QA found no defect. The status is BLOCKED only because the essential manual acceptance needs the user (HIL 3).
