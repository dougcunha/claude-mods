# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T08 — A crafted token cannot stop the page server

## Outcome

A request whose token has the right character count but another byte count gets HTTP 403, and the server keeps running.

## Dependencies and boundaries

- Depends on: —
- Unblocks: —
- In scope: the token comparison in `server/server.mjs`.
- Out of scope: other server checks (O-10 stays an optional improvement).

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-01 | `codereview.md#Findings` | `timingSafeEqual` throws on a token of 64 non-ASCII characters, and the server exits |

## Requirements

- NFR-01: a request without the right token gets 403; no token value stops the server.
- Compare byte lengths before `timingSafeEqual`.

## Context to recover on demand

- TechSpec: `#errors-security-and-recovery` (Security).
- Code: `server/server.mjs:isToken` (line 76), the `error` exit at lines 62-65.

## Work

- [x] T08.1 `isToken`: compare `Buffer.from(value)` byte length with the token's before `timingSafeEqual`.
- [x] T08.2 Manual check against a live server: `?t=` of 64 `%C3%A9`, a wrong ASCII token, the right token.

## Acceptance criteria

- The crafted token gets 403, and a later request with the right token gets 200 from the same server.

## Verification

- Unit: not applicable (the server has no test runner, DEC-07).
- Kit: not applicable.
- Real session: not applicable.
- Manual: `node server/server.mjs` on a session folder, `curl` with the 3 tokens; owner: the coordinator session.
- Platforms: Windows.
- Environment dependency: Node.js on the PATH.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`.
- Expected evidence: status codes 403, 403, 200, and the server process still alive.

## Affected files

- Modify: `visual-review/server/server.mjs`

## Observability and recovery

- Operational signal: none (a 403 is silent).
- Recovery: revert the line.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: `isToken` turns the value into bytes first and compares the byte length with the token's before `timingSafeEqual`, so a value of the right character count but another byte count is a plain mismatch (403), not a throw.
- Changed files: `visual-review/server/server.mjs`.
- Checks: live `server.mjs` on a session folder: `?t=` of 64 `%C3%A9` gives 403, 64 `a` gives 403, the right token gives 200, the process is still alive after the 3 requests, and the server printed no `error` line. `claude plugin validate visual-review`: passed; `claude plugin test visual-review`: 95 pass, 0 fail (same run as T09).
- Validated state: base `8d5ddeb` plus the T01–T09 diff; Windows 11, Node.js v24.20.0.
- Open items: none.
