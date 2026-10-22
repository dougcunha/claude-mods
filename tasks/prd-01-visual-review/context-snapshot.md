# Context snapshot — prd-01-visual-review

> Hints for the next session, not an authority: artifacts, manifests, handoffs, reports, and code win on conflict. Protocol: `.agents/skills/sdd-snapshot/SKILL.md`.

## Header

- status: closed
- generated: 2026-10-22
- stage: acceptance
- stage_source: qa_01/
- covers_through: qa_01 (BLOCKED only by the manual acceptance the user owns, W-05; no BUG-NN)
- authored_code: yes
- git_head: 8d5ddeb
- worktree: 3 changed + 3 untracked top-level paths: .claude-plugin/marketplace.json, README.md, visual-review/, tasks/ (this feature); .gitignore, skills-lock.json (pre-existing, not this feature)
- next_step: — (feature accepted at HIL 3, W-06)
- other_eligible: —
- superseded_by: —

## Load map

| Tier | Load when |
| --- | --- |
| `now` | Session start: header, next step brief, open threads waiting on the user |
| `on-select` | Chosen unit matches a trigger: task or finding ID, affected file, or traceability ID |
| `on-edit` | About to edit or create a path matching a trigger |
| `on-run` | About to run a matching command, or it just failed |
| `on-demand` | A gist is not enough: follow its `src:` pointer, that section only |

Review and QA sessions load only the header, next step brief, `Open threads`, and `on-run` entries.

Entry shape: `- [ID] (when: tier: trigger; trigger) gist — src: path#section; until: condition`

## Next step brief

- Why next: codereview_02 found no defect and qa_01 found no BUG-NN; both are held only by the manual acceptance the user owns (W-05). The checkpoint waits on HIL 3.
- Manual script: the "Manual acceptance" table of `qa_01/qa.md` (TC-19 real stacks and a second browser, hand-driven page loop and Copy review, keyboard and contrast, desktop app, macOS/Linux, sample approval).
- On acceptance: mark the checkpoint `completed` and this snapshot `closed`; commit only through the `commit` skill when the user asks. ADR candidates: none.
- Applicable entries: L-08, L-11, O-05, O-06, O-07.

## Decisions

- (none open: AUTO-11 to AUTO-13 are in `autonomous-decisions.md`)

## Learnings

- [L-01] (when: on-edit: visual-review/hooks/**) The hooks module has no Node, no `require`/`import()`, no port; a `$.process.spawn` child dies when its read loop leaves; the loop wakes only on a chunk (server prints a `tick` each second) — src: done/task_04.md#Handoff; until: types change
- [L-03] (when: on-run: claude --plugin-dir visual-review; on failure: hook not called) Org policy `cc-plugin-sec-default` skips `classic.SessionStart`, `session.append`, `prompt.compose`, `skill.prompt`; `turn.*`, `tool.call`, `command.run` reach the mod — src: done/task_02.md#Handoff; until: policy changes
- [L-08] (when: on-run: claude -p; real session) `claude -p "/visual-review"` sends the text to the model; use stream-json headless with the command as a later message; scripts `t07-static.sh` and `t07-stack.sh` in the T07 session scratchpad follow this pattern — src: tasks.md#Problems and solutions; until: next session
- [L-09] (when: on-edit: visual-review/**) Bash heredocs and Python escapes inside them drop backslashes (`\n`, regex `\\`); write files with Write/Edit — src: tasks.md#Problems and solutions; until: next session
- [L-10] (when: on-run: tsc -p visual-review) The engine did not lay `.claude-plugin/types/`; a copy of session-info's (ignored) folder sits there, and its `claude-code-mcp/index.d.ts` declares only `mcp__visual-review__submit_model` — src: autonomous-decisions.md#AUTO-06; until: engine lays types
- [L-11] (when: on-run: claude plugin test visual-review) Run once per check, save output to a scratchpad file, grep it (user instruction); kit fakes that throw read as "no implementation for <event>"; `fs.write` paths arrive in Windows form — src: tasks.md#Problems and solutions; until: next session
- [L-12] (when: on-run: playwright) The Playwright MCP writes `.playwright-mcp/` in the repo root; copy evidence to the scratchpad and delete the folder — src: done/task_05.md#Handoff; until: next session
- [L-13] (when: on-edit: visual-review/hooks/register.tsx) `$.prompt.submit` is refused inside `command.run` (AUTO-07, `$.clock.after(0)`); `explorer.exe` opens File Explorer for a URL with a query (AUTO-10, `rundll32 url.dll,FileProtocolHandler`) — src: autonomous-decisions.md; until: next session
- [L-14] (when: on-run: playwright; claude-in-chrome; static page) Playwright MCP and claude-in-chrome refuse `file:` URLs; drive the static page with `chrome.exe --headless=new --dump-dom` (Chrome at `%LOCALAPPDATA%/Google/Chrome/Application`) and a probe script; a served page never ends `--dump-dom` (event stream) — src: tasks.md#Problems and solutions; until: next session

## Code map

- (none: the review derives the code map from the sources)

## Open threads

- [O-07] (when: now; stage: review) `web/app.js` has 793 lines after round 1: outside the TypeScript quality profile, near its 800-line escalation trigger — src: workflow.md#Recovery events; until: next review

- [O-05] (when: now; stage: acceptance) T07.6 is partial: samples `shop-cs` and `shop-py` were built by the session (AUTO-13) and need the user's approval or the user's repositories; the desktop app was not run; macOS/Linux unverified — src: done/task_07.md#Handoff; until: HIL 3
- [O-06] (when: now; stage: acceptance) Still pending manual acceptance: visual check TC-19 with real stacks and 1 other browser (T05), the full comment loop in a live session (T06); real runs opened browser tabs and File Explorer windows on this machine — src: workflow.md#Recovery events; until: HIL 3
