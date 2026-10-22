# Implementation plan — visual-review

## Stable sources

- PRD: `tasks/prd-01-visual-review/prd.md`
- TechSpec: `tasks/prd-01-visual-review/techspec.md`

> Common sources come before the task and mutable state; read order does not guarantee a cache hit.

## Dependency graph

| ID | Delivery | Depends on | Unblocks |
| --- | --- | --- | --- |
| T01 | `/visual-review` is installed, resolves the base, collects the changed files, and reports each error case | — | T02 |
| T02 | The command starts the analysis; the subagent sends the model to `submit_model`; gaps go back; progress and failure show | T01 | T03 |
| T03 | An accepted model becomes a view model with Git line deltas, Ce/Ca, containers and tables, written to the temp folder | T02 | T04 |
| T04 | A local server serves the view model with token checks and opens the browser; a second run updates the open tab | T03 | T05 |
| T05 | The page draws the diagram: cards, relations, table layer, containers, filter, keyboard and themes | T04 | T06 |
| T06 | The reviewer comments, submits, and sees the comments again on the next run | T05 | T07 |
| T07 | Without Node.js a static page with "Copy review" opens; the README and the real-session acceptance on 3 stacks are done | T06 | — |

## Traceability matrix

| Source ID | Source section | Obligation | Tasks | Evidence or test |
| --- | --- | --- | --- | --- |
| OBJ-01 | `prd.md#outcomes-and-metrics` | Every changed source file covered | T02, T03, T07 | TC-05, TC-09, real session |
| OBJ-02 | `prd.md#outcomes-and-metrics` | Review back in 1 action | T06 | TC-14, real session |
| OBJ-03 | `prd.md#outcomes-and-metrics` | Comments traceable across rounds | T06 | TC-11 |
| OBJ-04 | `prd.md#outcomes-and-metrics` | Exact numbers | T03 | TC-07 |
| FR-01 | `prd.md#functional-requirements` | Command registered, manual only | T01 | TC-01 |
| FR-02 | `prd.md#functional-requirements` | Default base and untracked files | T01 | TC-02 |
| FR-03 | `prd.md#functional-requirements` | Base argument and invalid reference | T01 | TC-03 |
| FR-04 | `prd.md#functional-requirements` | No repository or empty diff | T01 | TC-03 |
| FR-05 | `prd.md#functional-requirements` | Subagent analysis with configurable model | T02 | TC-13 |
| FR-06 | `prd.md#functional-requirements` | Coverage check and retry | T02 | TC-05, TC-06 |
| FR-07 | `prd.md#functional-requirements` | Unit kinds incl. module | T03 | TC-09 |
| FR-08 | `prd.md#functional-requirements` | Unit states incl. context | T03, T05 | TC-09, TC-19 |
| FR-09 | `prd.md#functional-requirements` | Card fields | T03, T05 | TC-09, TC-19 |
| FR-10 | `prd.md#functional-requirements` | Line deltas from Git | T03 | TC-07 |
| FR-11 | `prd.md#functional-requirements` | Ce and Ca | T03 | TC-08 |
| FR-12 | `prd.md#functional-requirements` | Relation kinds and states | T03, T05 | TC-09, TC-19 |
| FR-13 | `prd.md#functional-requirements` | Tables and columns | T03, T05 | TC-09, TC-19 |
| FR-14 | `prd.md#functional-requirements` | Table sources per stack | T02, T07 | TC-13, real session |
| FR-15 | `prd.md#functional-requirements` | Table layer, entity links, filter | T03, T05 | TC-09, TC-19 |
| FR-16 | `prd.md#functional-requirements` | Other files list | T03, T05 | TC-09 |
| FR-17 | `prd.md#functional-requirements` | Containers open and closed | T03, T05 | TC-10, TC-19 |
| FR-18 | `prd.md#functional-requirements` | Comment anchors and types | T06 | TC-11, TC-19 |
| FR-19 | `prd.md#functional-requirements` | Review prompt | T06 | TC-13 |
| FR-20 | `prd.md#functional-requirements` | Submit waits for idle; page confirms | T06 | TC-14 |
| FR-21 | `prd.md#functional-requirements` | Open browser; tab updates | T04 | TC-17, TC-19 |
| FR-22 | `prd.md#functional-requirements` | Comments stored by project and branch | T06 | TC-11 |
| FR-23 | `prd.md#functional-requirements` | Unanchored list | T06 | TC-11 |
| FR-24 | `prd.md#functional-requirements` | Static fallback | T07 | TC-17, manual |
| FR-25 | `prd.md#functional-requirements` | Progress and failure | T02 | TC-15 |
| NFR-01 | `prd.md#non-functional-requirements` | Loopback and token | T04 | TC-18 |
| NFR-02 | `prd.md#non-functional-requirements` | Offline page | T04, T05 | QA-06, TC-18 |
| NFR-03 | `prd.md#non-functional-requirements` | Supported API only | T01–T07 | QA-04, QA-05, review |
| NFR-04 | `prd.md#non-functional-requirements` | Determinism | T03 | TC-07 |
| NFR-05 | `prd.md#non-functional-requirements` | 100 units in 3 s | T05 | TC-19 |
| NFR-06 | `prd.md#non-functional-requirements` | Server ends with the session | T04 | TC-18 |
| NFR-07 | `prd.md#non-functional-requirements` | Accessibility | T05, T06 | TC-19 |
| NFR-08 | `prd.md#non-functional-requirements` | Platforms and surfaces | T04, T07 | TC-17, manual |
| NFR-09 | `prd.md#non-functional-requirements` | Store limit | T06 | TC-12 |
| NFR-10 | `prd.md#non-functional-requirements` | 1 analysis per run | T01, T02 | TC-01, TC-06 |
| NFR-11 | `prd.md#non-functional-requirements` | English text | T01–T07 | review |
| DEC-01 | `techspec.md#technical-decisions` | Subagent + tool | T02 | TC-06, TC-13 |
| DEC-02 | `techspec.md#technical-decisions` | Node server, port 0, token | T04 | TC-16, TC-18 |
| DEC-03 | `techspec.md#technical-decisions` | `view.json` in temp folder + watch | T03, T04 | TC-06, TC-19 |
| DEC-04 | `techspec.md#technical-decisions` | Comment lines on stdout to `$.store` | T06 | TC-11, TC-14 |
| DEC-05 | `techspec.md#technical-decisions` | Own cards + ELK.js 0.9.3 vendored | T05 | TC-19 |
| DEC-06 | `techspec.md#technical-decisions` | Classic scripts; `view.js` for static | T05, T07 | manual |
| DEC-07 | `techspec.md#technical-decisions` | Logic in helpers | T03, T06 | TC-07–TC-12 |
| DEC-08 | `techspec.md#technical-decisions` | Ranges and name check | T02, T03 | TC-05, TC-07 |
| DEC-09 | `techspec.md#technical-decisions` | Model text in temp files accepted | T03 | review |
| DEC-10 | `techspec.md#technical-decisions` | Command not immediate | T01 | TC-01 |
| DEC-11 | `techspec.md#technical-decisions` | Failure by `turnId` | T02 | TC-15 |
| CMP-01 | `techspec.md#components-and-flow` | `register.tsx` | T01–T07 | kit tests |
| CMP-02 | `techspec.md#components-and-flow` | `host.ts` | T01 | tsc |
| CMP-03 | `techspec.md#components-and-flow` | `git.ts` | T01, T03 | TC-02, TC-04 |
| CMP-04 | `techspec.md#components-and-flow` | `model.ts` | T02 | TC-05 |
| CMP-05 | `techspec.md#components-and-flow` | `metrics.ts` | T03 | TC-07, TC-08 |
| CMP-06 | `techspec.md#components-and-flow` | `view.ts` | T03, T06 | TC-09, TC-10, TC-11 |
| CMP-07 | `techspec.md#components-and-flow` | `comments.ts` | T06 | TC-11, TC-12 |
| CMP-08 | `techspec.md#components-and-flow` | `prompts.ts` | T02, T06 | TC-13 |
| CMP-09 | `techspec.md#components-and-flow` | `server.ts` | T04, T07 | TC-16, TC-17 |
| CMP-10 | `techspec.md#components-and-flow` | `server/server.mjs` | T04, T06 | TC-18 |
| CMP-11 | `techspec.md#components-and-flow` | `web/` | T04, T05, T06, T07 | TC-19 |
| CMP-12 | `techspec.md#components-and-flow` | Manifest, types, README, tests | T01, T07 | validate |
| CMP-13 | `techspec.md#components-and-flow` | Marketplace and root README | T01 | `claude plugin validate .` |
| TC-01…TC-19 | `techspec.md#test-approach` | Test cases | see each task | named tests |

## Tasks

- [T01 — Command, base and changed files](done/task_01.md): `/visual-review` resolves the base, lists the changed files, and reports each error case.
- [T02 — Analysis round trip](done/task_02.md): the command starts a subagent analysis that ends in an accepted or rejected `submit_model` call, with progress and failure feedback.
- [T03 — View model with exact numbers](done/task_03.md): an accepted model becomes `view.json` with Git line deltas, Ce/Ca, containers, tables and other files.
- [T04 — Local server and browser](done/task_04.md): a token-protected server on `127.0.0.1` serves the view model, opens the browser, and pushes updates by SSE.
- [T05 — Diagram page](done/task_05.md): the page draws cards, relations, tables, containers and the filter, offline, by keyboard, in both themes.
- [T06 — Comments and review submit](done/task_06.md): the reviewer comments on any anchor, submits once, and sees the comments with status on the next run.
- [T07 — Static fallback and acceptance](done/task_07.md): without Node.js the static page offers "Copy review"; README and real-session acceptance on C#, TypeScript and Python.

## Coverage gate

- Coverage: pass. Every OBJ, FR, NFR, DEC, CMP and TC maps to at least 1 task.
- Traceability: pass. Each task names its sources; the matrix above is the reverse index.
- Dependencies: pass. Linear chain T01 → T07, no cycle. Shared files: `register.tsx`, `server.mjs` and `web/app.js` change in several tasks, but tasks run one at a time.
- Atomicity: pass. Each task ends in an observable result with its tests. T05 is the largest (page drawing); it has no helper logic by DEC-07.
- Executability: pass. Commands from `AGENTS.md`; `node` v24.20.0 and `tsc` exist on this machine; Claude Code 2.1.308 installed (the TechSpec cites types of 2.1.301; the mod's own types are laid at its first load).
- Validation profile: pass with gaps. Helpers: unit tests with a fake `Host`. Hooks: kit tests on `terminal` and `desktop`. Server and page: manual script only (no runner in the repository, DEC-07). macOS and Linux: unverified unless a machine is available (recorded in T04 and T07).
- Idempotency: pass. Registration in `session.start` is safe to repeat; a rerun of the command replaces `pendingRun`; comment lines replace the draft set.

## Assumptions and open items

- Assumption: a subagent can load and call the deferred tool `mcp__visual-review__submit_model` through ToolSearch. T02 checks it first in a real session; the fallback is in the TechSpec risks.
- Assumption: `turn.start`, `turn.complete` and `tool.call` are not skipped by the organization policy. T02 checks it with `--debug-file`.
- Required environment: Node.js on the PATH for T04–T06 (present); a browser; a C# repository with EF Core, a TypeScript repository and a Python repository for the T07 acceptance (owner: the user supplies or approves the sample repositories).

## State

- [x] T01 — completed (handoff in `done/task_01.md`)
- [x] T02 — completed (handoff in `done/task_02.md`)
- [x] T03 — completed (handoff in `done/task_03.md`)
- [x] T04 — completed (handoff in `done/task_04.md`)
- [x] T05 — completed (handoff in `done/task_05.md`)
- [x] T06 — completed (handoff in `done/task_06.md`)
- [x] T07 — completed (handoff in `done/task_07.md`; T07.6 partial: the user's approval of the sample repositories, the desktop app, and macOS/Linux stay pending manual acceptance, AUTO-13)

## Problems and solutions

- T01: the engine (2.1.308) did not lay `.claude-plugin/types/` for the new mod, so `tsc` had no `claude-code` types. Solution: copy the engine-written types folder of `session-info` (ignored by its own `.gitignore`). AUTO-06.
- T01: `claude -p "/visual-review"` sends the text to the model, because the command registers in `session.start` after the first prompt. Solution for real-session checks: a stream-json headless run where the command is a later prompt.
- T01: a Bash heredoc dropped a backslash in a regular expression. Solution: write source files with the file tools, not heredocs.
- T02: the engine refuses `$.prompt.submit` from a `command.run` hook. Solution: submit from `$.clock.after(0)` once the hook answered (AUTO-07).
- T02: the copied types know only the MCP tools of `session-info`'s last save, so `{ tool: SUBMIT_TOOL }` did not type-check. Solution: the local, ignored `claude-code-mcp/index.d.ts` of `visual-review` declares only `mcp__visual-review__submit_model`, as the engine writes it after a save.
- T03: Bash heredocs turn `\\` into `\`, which broke `.join('\n')` literals in test files twice. Solution: write files with the file tools, or run a Python script saved with the Write tool.
- T03: the kit hands `fs.write` the path in the Windows form (`C:\Temp\...`) though the mod builds it with `/`. Solution: the kit test compares normalized paths.
- T04: `explorer.exe <url>` opens File Explorer for a URL with a query on this machine. Solution: `rundll32 url.dll,FileProtocolHandler <url>` (AUTO-10).
- T04: a kit fake that throws inside a `process.spawn` generator reaches the mod as "no implementation for process.spawn", not as the thrown error. Solution: the test asserts the toast prefix and names the call.
- T05: elkjs 0.9.3 ignores `elk.json.shapeCoords: ROOT`, so the first draw stacked every container's cards at the top. Solution: the page adds the parent offsets while it walks the laid-out graph.
- T05: a draw recreated the container header after the cards, so Tab skipped from a header to the end of the page and the focus fell to the body. Solution: each header enters the canvas before its cards, and every focusable element carries a `data-focus` key the draw restores.
- T05: the Playwright tool writes `.playwright-mcp/` in the repository root. Solution: copy the evidence to the scratchpad and remove the folder.
- T06 (found after completion, in Chrome with claude-in-chrome): the comment form showed before any element was chosen, because `.form { display: flex }` overrides the `hidden` attribute. Solution: `.form[hidden] { display: none }` in `web/style.css`; checked again in Chrome.
- T07: the Playwright MCP and claude-in-chrome both refuse `file:` URLs, so the static page could not be driven in them. Solution: Chrome's own `--headless=new --dump-dom` on a copy of the real `review.html` with a probe script that drives the form and Copy review and prints the result into the page. A served page never ends a `--dump-dom` run, because of its event stream.
- T07: Python string escapes in a Bash heredoc turned `\n` and `/\\/g` into a line break and `/\/g` in the kit test (L-09 again). Solution: fixed with the Edit tool.
- T07: six stale `.js` compiler outputs of a T01 `tsc` run sat next to the sources. Solution: deleted (AUTO-12).
