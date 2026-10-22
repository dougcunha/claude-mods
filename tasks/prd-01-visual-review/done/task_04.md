# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/prd.md`
2. `tasks/prd-01-visual-review/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T04 — Local server and browser

## Outcome

After the mod writes `view.json`, it starts the server once per module life, reads its `ready` line, and opens the browser at the token URL. The page (a minimal `web/index.html` that prints the counts from `/view` until T05) loads only with the token. A second run updates the open tab by SSE and opens no new tab. `session.end` and a module unload end the server.

## Dependencies and boundaries

- Depends on: T03
- Unblocks: T05
- In scope: `server.ts` (argv, line buffer, line parse, browser argv), `server/server.mjs` (static files, `/view`, `/events`, token and `Host` checks, file watch with retry and dedupe), `session.end`, a minimal page.
- Out of scope: diagram drawing (T05), comment and submit routes (T06), static fallback (T07).

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-21 | `prd.md#functional-requirements` | Open browser; tab updates |
| NFR-01, NFR-02, NFR-06, NFR-08 | `prd.md#non-functional-requirements` | Loopback and token, offline, server lifetime, platforms |
| DEC-02, DEC-03 | `techspec.md#technical-decisions` | Node server, file watch |
| CMP-09, CMP-10, CMP-11 (minimal) | `techspec.md#components-and-flow` | Server helper, server, page stub |
| TC-16, TC-17 (browser argv), TC-18 | `techspec.md#test-approach` | Line parser, argv, security and lifetime |

## Context to recover on demand

- Applicable skills and rules: `.agents/rules/mod-runtime.md` ("Processes", "Platforms"), quality rules QA-03, QA-05, QA-06.
- Existing code: `session-info/hooks/viewer.ts:launch`, `openUrl` (spawn loop and browser argv per platform).
- Contract or integration: `techspec.md#contracts-and-data` (Server lines), `techspec.md#integrations-and-interfaces` (HTTP routes), `techspec.md#errors-security-and-recovery` (security, file watch), `techspec.md#components-and-flow` (flow step 7).
- Engine reference: `$.process.spawn` (loop is the child's life), `ProcessSpawnRequest`, `$.plugin.root`, `session.end`.

## Work

- [x] T04.1 Create `hooks/server.ts`: server argv from `$.plugin.root` and the temp folder; a line buffer over spawn chunks; narrowing of `ready` and `error` lines; browser argv per platform.
- [x] T04.2 Create `server/server.mjs` with Node built-ins only: bind `127.0.0.1:0`, token, `Host` check, static files inside `web/`, `GET /view`, `GET /events`, watch with `VIEW_RETRY_MS` and `VIEW_RETRIES`, dedupe; print `ready`.
- [x] T04.3 Create a minimal `web/index.html` that reads `/view` with the token header and shows the counts; it updates on the SSE `model` event.
- [x] T04.4 In `register.tsx`: start the server after the first write, open the browser, keep the child in a module value, end it on `session.end`; toast a server `error`.
- [x] T04.5 Write `tests/server.test.ts` (TC-16, TC-17 browser argv); run the manual TC-18 script.

## Acceptance criteria

- A request without the token, or with a `Host` other than `127.0.0.1:<port>`, gets 403.
- A second `/visual-review` updates the open tab; no second tab opens.
- After `/clear` or the end of the session, no `node` process of the mod remains.

## Verification

- Unit: TC-16, TC-17 (browser argv per platform).
- Kit: `session.end` ends the loop (a fake spawn that records the end).
- Real session: run `/visual-review` 2 times; check 1 tab; run `curl` without the token (403) and with a wrong `Host` (403); `/clear`; check the process list.
- Manual: TC-18 script; owner: the developer.
- Platforms: Windows verified; macOS and Linux browser argv tested by unit only, real launch unverified unless a machine is available.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`; quality QA-03, QA-05, QA-06.
- Environment dependency: Node.js on the PATH (v24.20.0 present).
- Expected evidence: test count and exit code 0; 403 answers; process list after `/clear`.

## Affected files

- Modify: `visual-review/hooks/register.tsx`, `visual-review/hooks/host.ts`, `visual-review/tests/visual-review.test.ts`
- Create: `visual-review/hooks/server.ts`, `visual-review/server/server.mjs`, `visual-review/web/index.html`, `visual-review/tests/server.test.ts`

## Observability and recovery

- Operational signal: toast "Visual review ready" with the URL; toast on a server `error` line.
- Recovery: `/reload-plugins` ends the server; the next run starts a new one.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: after the mod writes `view.json`, it starts 1 page server per module life (`node server/server.mjs --dir <session folder> --web <mod>/web`), reads its `ready` line, opens the default browser at the token URL, and toasts `visual-review: Visual review ready: <url>`. The server binds `127.0.0.1:0`, checks the token (query `t` or `X-Review-Token`) and the `Host` header, serves files only inside `web/` (the token placeholder in HTML is replaced), `GET /view`, and `GET /events` (SSE), watches the session folder with retry and dedupe, prints `ready`, `error`, `clients` and a `tick` each second. A second run with a tab open updates that tab (toast `Visual review updated in the open tab`) and opens none. `session.end` stops the server at its next tick. A minimal `web/index.html` + `web/app.js` show the counts and update on the SSE `model` event. The tool result no longer carries a path or URL: the URL has the token, so it goes to the person in a toast.
- Changed files: created `visual-review/hooks/server.ts`, `server/server.mjs`, `web/index.html`, `web/app.js`, `tests/server.test.ts`; modified `hooks/register.tsx`, `hooks/host.ts` (`env().os`), `hooks/prompts.ts`, `hooks/view.ts` (`writeView` returns the folder), `tests/view.test.ts`, `tests/visual-review.test.ts`, `README.md`.
- Checks:
  - `claude plugin validate .` and `claude plugin validate visual-review`: passed.
  - `claude plugin test visual-review`: 73 pass, 0 fail, exit 0 (7 files).
  - `tsc -p visual-review`: exit 0.
  - Manual mutant pass: the stop check in the server loop disabled failed the NFR-06 kit test; the open-tab test inverted failed the FR-21 kit test. Both reverted, suite green.
  - Standalone server check (`node`, scratch script): no token 403, wrong token 403, header token 200, `Host: evil.example` 403, `Host: localhost:<port>` 403, token in the served HTML, `..%2f` escape 404, bad encoding 404, POST 405, CSP `default-src 'self'`; 2 writes of the same content gave 1 SSE `model` event with the new data.
  - Real session (stream-json headless, sample repository, `--plugin-dir visual-review`), TC-18 parts: live server `/view` without token 403, with token 200, wrong `Host` 403; after run 1 and run 2, 1 `node ... server.mjs` process; run 2 toasted `Visual review updated in the open tab` and spawned no second server or browser; 0 server processes after `/clear` (the debug log shows the server stopped 0.9 s after `session.end`) and after exit.
  - Quality profile: QA-01 to QA-06 no hit (`listen` names `127.0.0.1`; no `child_process` or `exec(` in `server/`; no `http(s)://` in `web/`). QA-07: only the known false matches and throws in test fakes.
- Validated state: base `8d5ddeb` plus the T01 to T04 diff; Windows 11, Claude Code 2.1.308, Node.js v24.20.0, default browser on this machine; kit tests on `terminal` and `desktop`.
- Open items:
  - `explorer.exe <url>` opened File Explorer (Documents), not the browser, for a URL with a query (seen on the screen in the first real run; up to 3 such windows were left open on this machine). Windows now uses `rundll32 url.dll,FileProtocolHandler <url>`, with no shell; the real run then connected the tab. AUTO-10.
  - The spawn read loop can stop the child only when a chunk arrives, so the server prints a `tick` line each second; `session.end` stops it within 1 s. AUTO-10.
  - The server also prints a `clients` line (open tabs); the mod opens a new tab only when none is connected, so a closed tab comes back on the next run (FR-21). AUTO-10.
  - macOS and Linux: browser argv tested by unit only; real launch unverified (no machine).
  - The CSP allows `style-src 'unsafe-inline'`; T05 checks whether ELK.js needs more (`unsafe-eval`).
  - Manual TC-18 network-panel check (only local requests) is left to the T05 page and the QA run.

### ADR candidates

None - direct TechSpec implementation or local decision.
