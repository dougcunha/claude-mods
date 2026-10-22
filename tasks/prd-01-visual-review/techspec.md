# TechSpec — visual-review

## Sources and traceability

- PRD: `tasks/prd-01-visual-review/prd.md` (approved at HIL 1 on 2026-10-22)
- Applicable instructions, rules, and skills: `AGENTS.md`; `.agents/rules/mod-hooks.md`, `mod-runtime.md`, `code-standards.md`, `javascript-typescript.md`, `tests.md`; skill `ts-tests` for the test count.
- Research: engine declarations of Claude Code 2.1.301 in `session-info/.claude-plugin/types/claude-code/index.d.ts` (`$.command.register`, `$.tool.register`, `ToolSpec`, `$.prompt.submit`, `$.process.run`, `$.process.spawn` with `ProcessSpawnRequest.input` (one-shot), `$.http.fetch`, `$.store`, `$.state`, `$.plugin.root`, `$.ui.status`, `$.ui.toast`, events `command.run`, `tool.call`, `turn.start`, `turn.complete`, `session.start`, `session.end`).
- Evidence in existing code:
  - `session-info/hooks/register.tsx:991-1032`: commands and a tool registered in `session.start`.
  - `session-info/hooks/register.tsx:1225-1234`: a `tool.call` hook that serves a mod tool and returns `{ result }` or `{ deny }`, with `e.agentId` for subagent calls.
  - `session-info/hooks/todos.ts:19`: a `ToolSpec` with an `inputSchema`.
  - `session-info/hooks/viewer.ts:launch`, `openUrl`: a spawned child whose read loop is its life, and the browser launch per platform.
  - `session-info/hooks/git.ts:50`: the per-session temp folder `<TEMP>/claude-<mod>/<session id>`.
  - `session-info/hooks/host.ts`: the `Host` boundary for helper modules.

## Solution summary

`visual-review` is a new mod. The `/visual-review` command collects the diff with Git and asks the session, through `$.prompt.submit`, to analyze it with a subagent. The subagent sends the design model to a tool that the mod registers. The mod checks the model, adds the exact numbers from Git and the coupling metrics, builds a view model, and writes it to the per-session temp folder. A small Node.js server that ships with the mod serves the page and the view model on `127.0.0.1`. The page draws the diagram with ELK.js. The comments of the reviewer go back to the mod through the standard output of the server, and the review goes to the session through `$.prompt.submit`.

All logic that decides something lives in helper modules under `hooks/`, with tests. The server and the page only move data and draw: the server relays HTTP to standard output, and the page draws the view model and collects comments. Without Node.js, the mod writes a static page that reads the same view model and offers "Copy review".

## Technical decisions

| ID | PRD obligations | Decision | Reason and evidence | Alternatives and trade-offs |
| --- | --- | --- | --- | --- |
| DEC-01 | FR-05, FR-06, NFR-10 | The command sends 1 analysis prompt. The prompt tells Claude to start 1 subagent with the model from `userConfig.analysisModel`. The subagent calls `mcp__visual-review__submit_model`. The tool returns the coverage gaps as its result, so the subagent fixes the model and calls again | The subagent can read files and see unchanged neighbors; `inputSchema` gives the shape; the main context gets only the subagent summary | `$.model.fork`: no tools, fails after `/clear` (`index.d.ts`, `model.fork`). `$.model.complete`: no history, no tools. Both need the whole diff in the prompt |
| DEC-02 | FR-20, FR-21, NFR-01, NFR-06 | A Node.js server `server/server.mjs`, started once per module life with `$.process.spawn`. It binds `127.0.0.1` on port 0, makes a random token, and prints 1 JSON line `ready` with the URL | The hooks environment cannot listen on a port (`index.d.ts` header, lines 19-24). The read loop of the spawn is the life of the child, so a module unload ends the server | A static file only: no way back to the session without copy and paste. The claude.ai Artifact: the design leaves the machine |
| DEC-03 | FR-21 | The mod gives each new view model to the server as a file: `<TEMP>/claude-visual-review/<session id>/view.json`. The server watches the file and pushes an SSE `model` event | `spawn.input` is one-shot (`ProcessSpawnRequest.input`). A file avoids `$.http.fetch` to loopback, which the organization web-fetch policy can refuse. `mod-runtime.md` allows files in this folder | `$.http.fetch` POST: depends on the policy. Restarting the server with `input`: a new port, so the open tab cannot reconnect |
| DEC-04 | FR-22, FR-23, NFR-09 | The server relays each comment change and each submit as 1 JSON line on standard output. The mod keeps the comments in `$.store` and writes them back into `view.json` | The browser cannot reach `$.store`; standard output is the only channel from the child to the mod. Drafts then survive a closed tab in interactive mode, which is better than the PRD assumption | Comments only in the browser: lost on a closed tab, and no history across runs |
| DEC-05 | NFR-02, NFR-07, FR-15, FR-17 | Own HTML and SVG cards; ELK.js `0.9.3` (`elk.bundled.js`, EPL-2.0) vendored in `web/vendor/` for the layout | ELK lays out nested containers and orthogonal edges, which FR-17 needs; vendoring keeps the page offline | Mermaid: no rich cards and no click targets. Cytoscape: rich cards are hard. Dagre: weak support for nested containers |
| DEC-06 | FR-24 | The page code is classic scripts, not ES modules. The static fallback is an HTML file in the temp folder that loads `web/app.js` and `elk.bundled.js` by `file://` URL and the view model from `view.js` (`window.VIEW = …`) | A browser blocks ES modules and `fetch` over `file://`; classic scripts load | A bundle step: the repository has no package manager or build |
| DEC-07 | FR-09, FR-10, FR-11, FR-17, FR-23 | The page draws a view model that the mod builds. Containers, closed state, Ce and Ca, line deltas, anchors and the unanchored list are calculated in helper modules | Logic in helpers has kit and unit tests (`tests.md`); the page and the server have no test runner in this repository | Logic in the page: no automated tests for it |
| DEC-08 | FR-10, NFR-04 | The subagent gives each unit its line range in the new file and, for a modified unit, in the base file. The mod checks that the first line of each range holds the unit name. The mod maps the `git diff -U0` hunks onto the ranges | Git gives exact line changes per file; only the analysis knows where a unit starts and ends | Parsers per language: out of scope in the PRD |
| DEC-09 | Sensitive data rule in `code-standards.md` | `view.json` and `view.js` hold summaries from the model and comment text. This is accepted: the page is the display of the mod, like the pane exception of the rule. The files live only in the per-session temp folder | The page cannot get the data in another way (DEC-03, DEC-06) | No file: no page |
| DEC-10 | FR-01, NFR-10 | The command is not `immediate`. It waits until the current turn ends, then runs | A review of the work in progress makes no sense; the command never interrupts a turn | `immediate: true`: an analysis can start in the middle of a turn |
| DEC-11 | FR-25 | The mod shows progress with `$.ui.status`. On the main loop (`agentId` absent), the `turn.start` whose `text` holds the `runId` of the pending run is the analysis turn; the mod keeps its `turnId`. At `turn.complete` with that `turnId` and no accepted model, the status clears and a toast names the cause (`reason`: answer, aborted, refusal, error). A `$.prompt.submit` result with `drop` ends the run at once with its reason | `TurnStartInput.text`, `turnId`, `agentId` and the `turnId` that `turn.complete` carries (`index.d.ts`, `TurnStartInput`); `PromptSubmitResult.drop`. `classic.*` hooks are skipped by the organization policy on this machine; `turn.*` hooks are not on that list | A timer: a long analysis is normal and has no fixed limit. A time match against the prompt: two turns can start close together |

## Components and flow

| ID | Component | New or modified | Responsibility | Dependencies |
| --- | --- | --- | --- | --- |
| CMP-01 | `visual-review/hooks/register.tsx` | New | Registers the command and the tool in `session.start`; serves `command.run`, `tool.call`, `turn.start`, `turn.complete`, `session.end`; builds the `Host`; owns the server child | CMP-02 to CMP-09 |
| CMP-02 | `visual-review/hooks/host.ts` | New | The `Host` type: `run`, `spawn`, `readFile`, `writeFile`, `env`, `sessionId`, `cwd`, `toast`, `status`, `submit`, `store*` | — |
| CMP-03 | `visual-review/hooks/git.ts` | New | Resolves the repository, the main branch, the base, the changed files (`--numstat -z -M`, untracked files) and the hunks (`-U0`); parses the output | CMP-02 |
| CMP-04 | `visual-review/hooks/model.ts` | New | The `inputSchema` of `submit_model`; narrows the tool input from `unknown`; checks coverage, ids and ranges; returns the gaps | CMP-03 |
| CMP-05 | `visual-review/hooks/metrics.ts` | New | Unit line deltas from hunks and ranges, Ce and Ca from relations, file rest lines | CMP-04 |
| CMP-06 | `visual-review/hooks/view.ts` | New | Builds the view model: containers, closed state, cards, table layer, entity links, other files, comments with anchors and the unanchored list | CMP-05, CMP-07 |
| CMP-07 | `visual-review/hooks/comments.ts` | New | The store key, comment merge, status changes, rounds, pruning near the store limit | CMP-02 |
| CMP-08 | `visual-review/hooks/prompts.ts` | New | The analysis prompt and the review prompt text | CMP-04, CMP-07 |
| CMP-09 | `visual-review/hooks/server.ts` | New | The server argv, the line buffer over spawn chunks, the parse of `ready`, `comments`, `submit` and `error` lines, the browser argv per platform | CMP-02 |
| CMP-10 | `visual-review/server/server.mjs` | New | Node.js only, no package: static files from `web/`, `GET /view` and SSE from `view.json`, `POST /comments` and `POST /submit` relayed to standard output; token and `Host` header checks | Node.js on the PATH |
| CMP-11 | `visual-review/web/index.html`, `app.js`, `style.css`, `vendor/elk.bundled.js` | New | Draws the view model, the filter and the containers; comment forms and the side panel; "Submit review" (server) or "Copy review" (static) | CMP-10 or `view.js` |
| CMP-12 | `visual-review/.claude-plugin/plugin.json`, `hooks/hooks.json`, `types/index.d.ts`, `tsconfig.json`, `README.md`, `tests/*.test.ts` | New | Manifest with `userConfig`, `$.state` contract, docs, tests | — |
| CMP-13 | `.claude-plugin/marketplace.json`, `README.md` (root) | Modified | Registers the mod and adds its row to the Mods table | CMP-12 |

Flow:

1. `command.run` (`/visual-review [base]`): CMP-03 resolves the repository and the base and collects the files and hunks. On an error or an empty diff, the hook answers with `text` and stops (FR-03, FR-04). Otherwise it saves `pendingRun` in `$.state`, sets the status, and calls `$.prompt.submit` with the analysis prompt from CMP-08.
2. The session runs the analysis turn. The subagent calls `submit_model`. The `tool.call` hook narrows and checks the input with CMP-04 against `pendingRun`. Gaps return `{ result }` with the list and the instruction to call again.
3. On a valid model, CMP-05 and CMP-06 build the view model with the comments from CMP-07. CMP-01 writes `view.json` (server mode) or `view.js` and `review.html` (static mode), clears `pendingRun` and the status, and returns `{ result }` with the URL.
4. Server mode: if no server runs, CMP-01 spawns CMP-10 and reads the `ready` line, then opens the browser. If a server runs, the file change updates the open tab by SSE and no new tab opens (FR-21).
5. The page posts each comment change. CMP-09 parses the line, and CMP-07 saves it in `$.store`. On `submit`, CMP-08 builds the review prompt from the draft comments; CMP-01 calls `$.prompt.submit`, marks the drafts as open in round N, and writes `view.json` again.
6. `turn.start` on the main loop with the `runId` in its text stores `analysisTurnId`. `turn.complete` with that `turnId` while `pendingRun` still waits: the status clears, `pendingRun` clears, and a toast says that the analysis ended with no model (FR-25).
7. `session.end`: the status clears and the server loop ends. This step is required: a `/clear` fires only `session.end` and the session id changes about 900 ms later, so the temp folder changes and a server that runs on would watch the old folder. The next run starts a new server.

## Contracts and data

### Command

`{ name: 'visual-review', description: 'Open a visual design review of the changes against a base branch or reference', argumentHint: '[base]' }`. `e.args` is trimmed; an empty value means the default base.

### Tool `submit_model`

`{ name: 'submit_model', description: <text in CMP-08 tests>, inputSchema: SUBMIT_SCHEMA, isDeferred: true }`. Full name `mcp__visual-review__submit_model`. The input:

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `runId` | string | yes | Equals `pendingRun.runId`; another value gets "This analysis was replaced by a newer /visual-review run." |
| `units[]` | object | yes | `id` (fully qualified name), `name`, `kind` (`class`, `interface`, `record`, `struct`, `enum`, `module`), `state` (`added`, `modified`, `deleted`, `context`), `file` (repository-relative), `container` (namespace or folder) |
| `units[].range` | `{ start, end }` | not for `context` | New file lines; base file lines for `deleted`. `start` line text contains `name` (DEC-08) |
| `units[].baseRange` | `{ start, end }` | `modified` only | Base file lines |
| `units[].methods` | integer ≥ 0 | not for `context` | |
| `units[].members[]` | object | no | Changed members: `id` (signature), `name`, `kind` (`method`, `property`, `field`, `constructor`), `state` (`added`, `modified`, `deleted`) |
| `units[].summary` | string | not for `context` | 1 to 3 sentences |
| `units[].cohesion` | `{ score: 1..5, reason }` | not for `context` | |
| `relations[]` | object | yes (may be empty) | `from`, `to` (unit ids), `kind` (`inheritance`, `implementation`, `composition`, `dependency`), `state` (`added`, `removed`, `unchanged`) |
| `tables[]` | object | yes (may be empty) | `id` (`schema.table` or `table`), `state` (`added`, `modified`, `dropped`), `source` (file), `entity?` (unit id), `columns[]`: `name`, `type`, `baseType?`, `state` (`added`, `modified`, `dropped`, `unchanged`), `isPrimaryKey?`, `references?` (`table.column`) |
| `skippedFiles[]` | `{ file, reason }` | no | Generated files, such as `*.Designer.cs` and the EF model snapshot |

Coverage: each changed file whose extension is in `SOURCE_EXTENSIONS` (`.cs`, `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.py`, `.sql`, `.prisma`) is a `units[].file`, a `tables[].source`, or a `skippedFiles[].file`. Each other changed file goes to "Other files" (FR-16). Each `relations[].from`, `to` and `tables[].entity` names a unit in the model.

Ce and Ca (FR-11): over relations whose state is not `removed`, distinct ids, no self relation, context units included.

### `$.state` (declared in `visual-review/types/index.d.ts`)

| Key | Type | Notes |
| --- | --- | --- |
| `pendingRun` | `{ runId, base, baseLabel, root, branch, files, analysisTurnId? } \| null` | Survives a hot reload between the command and the tool call. `/clear` resets it, which cancels a run in progress. The hunks are not stored: the `tool.call` hook runs `git diff -U0` again, so the state stays small |

The server child, its URL and token are module values: the child dies with the module, so they cannot outlive it (`mod-hooks.md`, "Registration and lifetime").

### `$.store`

| Key | Value |
| --- | --- |
| `review:<root key>:<branch>` | `{ version: 1, round, updatedAt, comments: Comment[] }` |

`Comment`: `{ id, anchor: { kind: 'unit' \| 'member' \| 'relation' \| 'table' \| 'column' \| 'review', id }, type: 'change' \| 'question', text, status: 'draft' \| 'open' \| 'resolved', round }`. Anchor ids: unit and table ids; `<unit id>#<member id>`; `<table id>.<column>`; `<from>→<to>→<kind>` for a relation. A value that fails to narrow is dropped, not repaired. When the total JSON size of the keys is above `STORE_SOFT_LIMIT_BYTES` (3 MiB), the key with the oldest `updatedAt` goes first (NFR-09).

### `userConfig`

| Key | Type | Default | Options |
| --- | --- | --- | --- |
| `analysisModel` | string | `sonnet` | `sonnet`, `opus`, `haiku`, `inherit` (the subagent uses the model of the session) |

### Server lines (standard output, 1 JSON object per line)

`{ "type": "ready", "url": "http://127.0.0.1:<port>/?t=<token>" }`, `{ "type": "comments", "comments": [...] }`, `{ "type": "submit" }`, `{ "type": "error", "message": "..." }`. CMP-09 drops a line that does not parse or narrow.

### Text the mod adds to the session

- The analysis prompt names the base, the changed files with their line counts, the `runId`, the model for the subagent, the schema rules that a JSON schema cannot say (ranges, coverage, `skippedFiles`), the instruction to load the tool with ToolSearch, and the instruction to answer the person in 1 line when the page is ready.
- The review prompt lists the draft comments grouped by anchor, with type and text, and the status changes of older comments. It tells Claude to answer each question, to propose a plan for the change requests, and to wait for confirmation before it changes a file (FR-19).

Tests assert the exact text of both prompts and of the tool description (`tests.md`, "Agent-facing text").

## Integrations and interfaces

| Hook or noun | Use | Failure choice |
| --- | --- | --- |
| `session.start` | Registers the command and the tool; reads `options` once | Observer; ends in `next(e)`; a failed tool registration shows a toast and leaves the command, which then says the tool is missing |
| `command.run` (`visual-review`) | Flow step 1 | Gating, with `.catch`: answers `{ text: 'visual-review: <cause>' }` and clears `pendingRun`, because the person waits for an answer |
| `tool.call` (`mcp__visual-review__submit_model`) | Flow steps 2 and 3 | Gating, with `.catch`: answers `{ result: 'visual-review failed: <cause>' }` so the subagent stops and reports; it never denies |
| `turn.start`, `turn.complete` | Flow step 6 | Observers; `.catch(($, e, next) => next(e))` |
| `session.end` | Clears the status and ends the server loop | Observer |
| `$.process.run` | `git` (read-only, repository as `cwd`), `node --version` | Timeout 30 s; a missing `git` or `node` is a normal case |
| `$.process.spawn` | The server; the browser launch (`explorer.exe`, `open`, `xdg-open`) | The server loop runs on after the hook returns; its end shows a toast if the server wrote `error` |
| `$.fs.write` | `view.json`, `view.js`, `review.html` under `<TEMP>/claude-visual-review/<session id>/` | Write failure: the tool returns the cause |
| `$.prompt.submit` | Analysis prompt, review prompt | Runs when the session is idle (`index.d.ts`, `prompt.submit`) |
| HTTP (server) | `GET /`, static files, `GET /view`, `GET /events` (SSE), `POST /comments`, `POST /submit` | Wrong token or `Host` header: 403. Body above 1 MiB: 413 |

Git commands (CMP-03), all with the repository root as `cwd`:

1. `git rev-parse --show-toplevel` and `git rev-parse --abbrev-ref HEAD`.
2. Main branch: `git symbolic-ref --short refs/remotes/origin/HEAD`, else `main`, else `master`, each checked with `git rev-parse --verify --quiet <ref>^{commit}`.
3. Base: `git merge-base HEAD <main>`; with an argument, `git rev-parse --verify --quiet <arg>^{commit}`.
4. Files: `git diff --numstat -z -M <base>` and `git ls-files --others --exclude-standard -z`.
5. Hunks: `git diff -U0 --no-color -M <base>`. A truncated output (`isStdoutTruncated`) keeps the file totals and marks unit deltas as unknown.
6. Base file text for a range check: `git show <base>:<path>`.

## Errors, security, and recovery

- Errors and edges:
  - No repository, empty diff, unknown reference: the command text from the PRD; no prompt.
  - A second `/visual-review` while a run waits: the new run replaces `pendingRun`; an old `runId` gets the "replaced" result.
  - A `submit_model` call with no pending run: the result says that no review waits and to run `/visual-review`.
  - A binary file: numstat gives `-`; it goes to "Other files" with no counts.
  - A file larger than 4 MiB cannot be read for a range check: the check is skipped for that file and the card says "range not checked".
  - `node` missing or the server exits before `ready`: static mode with the reason in a toast (FR-24).
  - The module reloads (`/reload-plugins`, a `/config` change): the server ends; the next run starts a new server and a new tab.
- User files and sensitive data: Git is read-only. The mod writes only under its temp folder (DEC-09). The server reads only `web/` and the temp folder, and resolves each static path inside `web/` (no `..`).
- Security: bind `127.0.0.1` only; token from `crypto.randomBytes(32)`; the page sends the token in the `X-Review-Token` header on every request after the first load, and `EventSource` uses the query token; the server checks that `Host` is `127.0.0.1:<port>` to block DNS rebinding. A request from another origin cannot send the custom header without a preflight, and the server answers no preflight.
- File watch: `$.fs.write` is not atomic, and `fs.watch` can fire 2 times for 1 write on Windows. The server reads `view.json` again after `VIEW_RETRY_MS` (100 ms) when the JSON does not parse, at most `VIEW_RETRIES` (5) times, and sends no `model` event when the content equals the last one sent.
- Concurrency and idempotency: `session.start` registration is safe to repeat on a reload. Only 1 server per module life. Comment lines replace the draft set as a whole, so a repeated line does not duplicate comments.
- Rollback or reversal: uninstall the mod. The store keys stay until `$.store` pruning or a manual delete; they do nothing without the mod.

## Sequencing

| Step | Depends on | Verifiable result |
| --- | --- | --- |
| 1. Mod skeleton: manifest, `hooks.json`, `types`, `tsconfig`, `Host`, registration of command and tool, marketplace and root README rows | — | `claude plugin validate .` and `claude plugin validate visual-review` pass; the command shows in the menu |
| 2. Git collection and base resolution (CMP-03) | 1 | Parser tests on real `git` output samples; FR-02, FR-03, FR-04 tests |
| 3. Model schema, narrowing and coverage (CMP-04) | 2 | FR-06 tests: gaps named per file, wrong `runId`, bad range |
| 4. Metrics and view model (CMP-05, CMP-06) | 3 | FR-08 to FR-17 tests on fixtures for C#, TypeScript and Python |
| 5. Prompts and the command and tool hooks (CMP-08, CMP-01) | 3 | Exact-text tests; kit tests for `command.run` and `tool.call` |
| 6. Server and line protocol (CMP-09, CMP-10) | 1 | Line parser tests; manual check of token, `Host` and SSE |
| 7. Page (CMP-11) | 4, 6 | Manual script on Windows plus 1 other platform; NFR-05 timing with the 100-unit fixture |
| 8. Comments, store and review submit (CMP-07, flow step 5) | 5, 6, 7 | FR-18 to FR-23 tests; manual round trip |
| 9. Static fallback, progress and failure (FR-24, FR-25) | 7 | Kit test for `turn.complete`; manual run with `node` off the PATH |

## Test approach

- Profile: new mod `visual-review`; surfaces: a command, a deferred tool, `$.ui.status` and toasts, no pane. Claude Code 2.1.301. `tsconfig.json` extends `./.claude-plugin/types/tsconfig.json`. Kit `claude-code/testing`. Commands from `AGENTS.md`, one at a time: `claude plugin validate .`, `claude plugin validate visual-review`, `claude plugin test visual-review`, then `tsc -p visual-review` when TypeScript is installed. Check the test count and the exit code.
- Real session: add the clone as a folder marketplace, install `visual-review`, `/reload-plugins`, make a change in a C# repository with 1 EF Core migration, run `/visual-review`, comment, submit. Repeat in a TypeScript and a Python repository.
- Platforms: Windows (this machine) for the full script; macOS or Linux for the browser launch and the server, or record them as unverified. The kit tests run on the `terminal` and `desktop` surfaces where a hook answer differs; there is no pane.
- Command prerequisites and exclusions: `node` on the PATH for server mode. The server and the page have no automated runner in this repository; they stay thin (DEC-07) and are covered by the manual script.
- Manual acceptance: the developer runs the real-session script and records the result in the QA report.

| ID | Obligations | Level | Scenario | Expected result | Command or suite |
| --- | --- | --- | --- | --- | --- |
| TC-01 | FR-01, DEC-10 | kit | `session.start` | The command registers with the description and the argument hint, not `immediate`; the tool registers deferred | `tests/visual-review.test.ts` |
| TC-02 | FR-02 | unit | Main branch from `origin/HEAD`, from `main`, from `master`; untracked files listed | The base and the file list match the samples | `tests/git.test.ts` |
| TC-03 | FR-03, FR-04 | kit | Unknown reference; not a repository; empty diff | The command text names the cause; no `prompt.submit` call | `tests/visual-review.test.ts` |
| TC-04 | — | unit | `--numstat -z` with a rename, a binary file and spaces in names; `-U0` hunks with 0-length sides | Counts and hunk ranges are correct | `tests/git.test.ts` |
| TC-05 | FR-05, FR-06 | unit | Model without a changed `.cs` file; a `skippedFiles` entry; a relation to an unknown id; a range whose first line lacks the name | Each gap names its file or id; the skipped file passes | `tests/model.test.ts` |
| TC-06 | FR-06 | kit | `tool.call` with a valid model, with gaps, with an old `runId`, with no pending run | `{ result }` text for each case; a valid model writes the view file | `tests/visual-review.test.ts` |
| TC-07 | FR-10, NFR-04 | unit | 1 unit in a file; 2 units and lines outside them; an added and a deleted unit | Unit deltas plus the rest equal the file numstat; 2 runs on the same model give the same numbers | `tests/metrics.test.ts` |
| TC-08 | FR-11 | unit | A graph with a removed relation, a self relation and a duplicate | Ce and Ca count distinct live relations only | `tests/metrics.test.ts` |
| TC-09 | FR-07, FR-08, FR-09, FR-12, FR-13, FR-15, FR-16 | unit | C#, TypeScript and Python fixture models | The view model has the states, card fields, table layer, entity links and other files | `tests/view.test.ts` |
| TC-10 | FR-17 | unit | Containers with only context units and with changed units | Closed and open defaults are correct | `tests/view.test.ts` |
| TC-11 | FR-18, FR-22, FR-23 | unit | Merge a comment line; mark resolved; rerun with a missing anchor | Statuses and the unanchored list are correct | `tests/comments.test.ts` |
| TC-12 | NFR-09 | unit | Store keys above the soft limit | The oldest key is removed first | `tests/comments.test.ts` |
| TC-13 | FR-19, FR-05 | unit | The review prompt and the analysis prompt with each `analysisModel` value | Exact text; it changes only with the option | `tests/prompts.test.ts` |
| TC-14 | FR-20 | kit | A `submit` line from the server | `prompt.submit` gets the review prompt; drafts become open in the new round | `tests/visual-review.test.ts` |
| TC-15 | FR-25, DEC-11 | kit | `turn.start` with the `runId`, then `turn.complete` with its `turnId` and no model; a `turn.complete` of another turn; a `prompt.submit` result with `drop` | The first and the third clear the status and toast the cause; the second changes nothing | `tests/visual-review.test.ts` |
| TC-16 | — | unit | Server lines split across chunks, a bad JSON line, an unknown type | Whole lines parse; bad lines drop | `tests/server.test.ts` |
| TC-17 | FR-21, FR-24 | unit | Browser argv per platform; static mode when `node --version` fails | The argv and the mode are correct | `tests/server.test.ts` |
| TC-18 | NFR-01, NFR-02, NFR-06 | manual | Request without token, with a wrong `Host`; network panel; session end | 403; only local requests; no `node` process after the session ends | Manual script |
| TC-19 | NFR-05, NFR-07, NFR-08, FR-15, FR-17, FR-18, FR-21 | manual | 100-unit fixture; keyboard only; light and dark; a second run with the tab open | Interactive in 3 s or less; all actions by keyboard; state labels visible; the tab updates | Manual script |

## Quality profile

Rules this feature can violate. A blocking hit prevents task completion and rejects the review; a reservation becomes an optional improvement and counts toward escalation. A hit covered by `DEC-NN` is expected, not a finding.

```bash
RG=(rg -n --type ts -g '!node_modules/**' -g '!**/.claude-plugin/types/**')
files=(visual-review/hooks/*.ts visual-review/hooks/*.tsx visual-review/tests/*.ts)
helper_files=(visual-review/hooks/{git,model,metrics,view,comments,prompts,server}.ts)
mod_files=(visual-review/hooks/*.ts visual-review/hooks/*.tsx)
```

| ID | Rule | Class | Verification command | Prior justification |
| --- | --- | --- | --- | --- |
| QA-01 | No `any` | blocking | `"${RG[@]}" ':\s*any\b\|\bas any\b\|<any>' "${files[@]}"` | — |
| QA-02 | No empty `catch` on a call the person waits for | blocking | `"${RG[@]}" -U 'catch\s*(\([^)]*\))?\s*\{\s*\}\|\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)' "${files[@]}"` | — |
| QA-03 | No shell string | blocking | `"${RG[@]}" "'cmd', '/c'\|'(sh\|bash)', '-c'\|shell:\s*true" "${files[@]}"` and `rg -n "child_process\|exec\(" visual-review/server` | — |
| QA-04 | No `$` or `'claude-code'` value in a helper module | blocking | `"${RG[@]}" '^(?!\s*(/?\*\|//)).*(from .claude-code.\|\$\.(fs\|process\|ui\|store\|session\|clock\|env\|prompt\|mcp)\.)' --pcre2 "${helper_files[@]}"` | — |
| QA-05 | No `node:*`, `require`, `import()`, timers or `console` in the hooks module | blocking | `"${RG[@]}" "from 'node:\|require\(\|\bimport\(\|\bsetTimeout\|\bsetInterval\|console\." "${mod_files[@]}"` | — |
| QA-06 | The server binds only to loopback; the page loads nothing from the network | blocking | `rg -n "0\.0\.0\.0\|listen\(" visual-review/server` (each `listen` names `127.0.0.1`) and `rg -n "https?://" visual-review/web -g '!vendor/**'` (no hit except `127.0.0.1` in text) | — |
| QA-07 | No throw in a hook path, no uninjected clock or random in helpers, 4+ parameters, files above 500 lines | reservation | `"${RG[@]}" 'throw new Error\(' "${files[@]}"`; `"${RG[@]}" 'Date\.now\(\)\|new Date\(\)\|Math\.random\(\)' "${helper_files[@]}"`; `"${RG[@]}" '\((?:[^(),]+,){3,}[^()]*\)\s*(?::\s*[^={]+)?\s*(?:\{\|=>)' "${files[@]}"`; `rg -c -H '^' "${files[@]}" \| awk -F: '$2 > 500'` | — |

- Verification scope: the files of the task diff under `visual-review/`.
- Escalation trigger: 8 or more reservation hits, a touched file above 800 lines, or the same block in 3 or more places.

### Terrain baseline

| File | Lines | Exported members | Max parameters | Cases | Pre-existing hits | Destination |
| --- | --- | --- | --- | --- | --- | --- |
| `.claude-plugin/marketplace.json` | 22 | — | — | — | none (JSON, no profile rule) | recorded |
| `README.md` | 106 | — | — | — | none (Markdown, no profile rule) | recorded |

All other target files are new and start clean.

- Preparatory refactoring: not recommended. The feature adds 1 entry to each existing file.

## Observability and rollout

- Signals: `$.ui.status` during the analysis; toasts for ready, failure, static mode and a server error. No prompt text, model text or comment text goes to a toast or a log (`code-standards.md`).
- Migration and compatibility: new mod; the store value carries `version: 1`, and a value with another version is ignored.
- Rollout and rollback: version `0.1.0` in `plugin.json`; release through `/plugin marketplace update`; rollback by uninstall.

## Risks and open items

- Resolved (2026-10-22, user): OBJ-04 and NFR-04 now say that file totals are identical for the same diff, and unit deltas, Ce and Ca for the same design model. TC-07 tests both.
- Risk: the subagent cannot see a deferred plugin tool. Probability low, impact high. Mitigation: the prompt tells the subagent to load the tool with ToolSearch; the manual script checks it first. Fallback: the subagent returns the JSON and the main thread calls the tool, at a higher context cost.
- Risk: the organization policy skips `turn.complete` or `tool.call`. Mitigation: check with `--debug-file` in the first real session; without `turn.complete`, FR-25 falls back to the status and a later toast at the next run.
- Risk: the range check of DEC-08 rejects a valid unit whose declaration starts with an attribute or a decorator line. Mitigation: the check accepts the name in the first 5 lines of the range (`RANGE_NAME_LINES`).
- Risk: `elk.bundled.js` adds about 1.6 MB to the repository and carries the EPL-2.0 license. Mitigation: keep its license header and name it in the README.
- Risk: the temp folder is not removed by the mod, because `$.fs` has no delete. The system cleans the temp directory (`mod-runtime.md`, "Files").

## Relevant files

- Modify: `.claude-plugin/marketplace.json`, `README.md`
- Create: `visual-review/.claude-plugin/plugin.json`, `visual-review/hooks/hooks.json`, `visual-review/hooks/register.tsx`, `visual-review/hooks/host.ts`, `visual-review/hooks/git.ts`, `visual-review/hooks/model.ts`, `visual-review/hooks/metrics.ts`, `visual-review/hooks/view.ts`, `visual-review/hooks/comments.ts`, `visual-review/hooks/prompts.ts`, `visual-review/hooks/server.ts`, `visual-review/hooks/paths.ts`, `visual-review/server/server.mjs`, `visual-review/web/index.html`, `visual-review/web/app.js`, `visual-review/web/style.css`, `visual-review/web/vendor/elk.bundled.js`, `visual-review/types/index.d.ts`, `visual-review/tsconfig.json`, `visual-review/README.md`, `visual-review/tests/*.test.ts`
