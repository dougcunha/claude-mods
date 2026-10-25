# Code review report — feature-progress (02-feature-progress)

## Summary

- Status: REJECTED
- Execution: delegated reviewer (fresh-context subagent, same worktree; read-only explorers for 4 disjoint slices, evidence for each finding verified in this session)
- Git scope: `e58daa9d268f1dfe8119c5bdfa0716690b9babe0..worktree` (nothing committed: `M .claude-plugin/marketplace.json`, `M README.md`, `?? feature-progress/`, `?? tasks/`), plus the Git-ignored `.agents/` edits (T07, AUTO-03) and `D:/Projetos/agents-instructions` commit `8bad3bd` (T08) — see limitations
- Previous review: —

## Sources and scope

| Source | Path or reference | State |
| --- | --- | --- |
| PRD | `tasks/prd-02-feature-progress/prd.md` | read; sha256 `8f1b366d…` equals `checkpoint.json` `approved_sources` |
| TechSpec | `tasks/prd-02-feature-progress/techspec.md` | read; sha256 `bb03ab4c…` equals `approved_sources` |
| Manifest | `tasks/prd-02-feature-progress/tasks.md` | read; sha256 `ae8eaacf…` equals `approved_sources` (snapshot thread O-06 no longer applies) |
| Handoffs | `done/task_01.md` … `done/task_11.md` | read; all 11 links in `tasks.md` resolve |
| Workflow and decisions | `workflow.md` (W-01 … W-11), `autonomous-decisions.md`, `checkpoint.json` (generation 15, phase `review`) | read |
| Snapshot | `context-snapshot.md`, loaded with the independent-stage filter (header, next step brief, open threads, `on-run`) | `git_head` `e58daa9` = HEAD; worktree matches; `covers_through` says T09 open while `tasks.md` State has T09 `[x]`: snapshot behind, next step brief stale (load.md step 2) |
| Implementation | `feature-progress/**` (15 hook files, 9 test files, README, manifest, types), `.claude-plugin/marketplace.json`, `README.md`, `.agents/rules/mod-runtime.md`, `.agents/skills/**` (CMP-18), `D:/Projetos/agents-instructions` `master` at `8bad3bd` (CMP-19) | delimited, with the limitations below |
| Extra file in the feature folder | `tasks/prd-02-feature-progress/.claude/feature-progress/02-feature-progress.json` | a mod storage file (state `waiting`, only T10, updated 2026-10-25T11:45Z); Git-ignored by `.gitignore:5` (`.claude/`); see limitations |

## Coverage matrix

| Source | Obligation | Implementation | Test | State | Evidence |
| --- | --- | --- | --- | --- | --- |
| FR-01 | Tool registered with its contract | `hooks/register.tsx:147`, `hooks/spec.ts:13-22` | `tests/register.test.ts:52` | conformant | Description equals the TechSpec quote, 710/710 characters |
| FR-02 | Partial merge by task id | `hooks/report.ts:186-219` | `tests/report.test.ts:87,97` | conformant | Omitted fields keep stored values; new tasks append in order |
| FR-03 | `remove` | `hooks/report.ts:220,233` | `tests/report.test.ts:125` | conformant | Set filter; unknown ids ignored |
| FR-04 | Fields, titles on create | `hooks/report.ts:209-212` | `tests/report.test.ts:117` | conformant | Message names the field; check runs before the write (`register.tsx:93`) |
| FR-05 | 9 kinds | `hooks/report.ts:70,187,222` | `tests/report.test.ts:64`, `tests/register.test.ts:85` | conformant | Message lists `KINDS`; default `pending` |
| FR-06 | Timestamps | `hooks/report.ts:173-184,232` | `tests/report.test.ts:133,146` | conformant | `startedAt` once; `finishedAt` set and cleared; same code for the feature |
| FR-07 | One JSON per feature in the configured folder | `hooks/settings.ts:10,26`, `hooks/store.ts:23`, `hooks/paths.ts:18-22` | `tests/store.test.ts:36`, `tests/paths.test.ts:5-16`, `tests/register.test.ts:74` | conformant | Folder from `$.session.cwd()` + option; see the extra-file limitation |
| FR-08 | Reply text or error | `hooks/progress.ts:35-39` | `tests/progress.test.ts:25`, `tests/register.test.ts:74` | conformant | `feature-progress: fixing #1 · 12/17` |
| FR-09 | Band | `hooks/band.tsx:22-45`, `register.tsx:160-181` | `tests/band.test.ts:33,51` | conformant | Latest open feature; hidden with none |
| FR-10 | Band press opens the pane; command toggles | `register.tsx:172`, `register.tsx:101-112` | `tests/pane.test.ts:167,180` | non-conformant | CR-02 |
| FR-11 | Pane list, Done section | `hooks/pane.tsx:173-182,225-234` | `tests/pane.test.ts:67` | conformant | Latest first and expanded; Done collapsed |
| FR-12 | Task rows and groups | `hooks/pane.tsx:80-108`, `hooks/progress.ts:67-74` | `tests/pane.test.ts:67` | non-conformant | CR-03 (word for the kind); groups, bar, `done/total`, duration, note conform |
| FR-13 | `n/m` count | `hooks/progress.ts:30-32` | `tests/progress.test.ts:21` | conformant | 12/17 for the PRD case |
| FR-14 | Stale marker, timer without disk read | `register.tsx:150-153,169`, `pane.tsx:147,182` | `tests/band.test.ts:98`, `tests/register.test.ts:137` | conformant | Pane marker has no test (optional improvement) |
| FR-15 | Link with `editor` | `hooks/viewer.ts:34-48` | `tests/viewer.test.ts:30-74`, `tests/pane.test.ts:248` | conformant | Missing file toasts the path |
| FR-16 | Read at start and on Refresh only | `pane.tsx:211`, `register.tsx:209` | `tests/pane.test.ts:192`, `tests/register.test.ts:137` | conformant | Real-session TC-24: user statement only (W-10) |
| FR-17 | Clean command | `register.tsx:126-141`, `store.ts:146` | `tests/pane.test.ts:212,235`, `tests/store.test.ts:90` | conformant | Deletes only `done` files; toast `Deleted 2 done features.` |
| FR-18 | Unreadable file | `store.ts:117-123,134-135`, `register.tsx:88,95` | `tests/register.test.ts:118`, `tests/store.test.ts:47,53` | conformant | Warning row, `deny`, bytes unchanged |
| FR-19 | Skills report in both variants | `.agents/skills/sdd-orchestrate-tasks/references/progress-report.md:1-69` + links in the 8 CMP-18 files; `SKILLS/sdd-orquestrar-tasks/references/relatorio-progresso.md:1-71` + links in the 8 CMP-19 files (`master`, `8bad3bd`) | TC-20, TC-21 (`rg`) | conformant | Subagents never report (`progress-report.md:8`, `relatorio-progresso.md:8`) |
| FR-20 | State mapping | `progress-report.md:34-46`; `relatorio-progresso.md:33,37-46` | TC-20, TC-21; TC-22 manual | conformant | English matches the TechSpec column; Portuguese has no `qa` row |
| FR-21 | README contract | `feature-progress/README.md:23,45-49,57-131` | review | conformant | 3 valid example calls; `.gitignore` advice |
| FR-22 | `showBand` and `/feature-progress band` | `register.tsx:35,118-123,160`, `settings.ts:30` | `tests/band.test.ts:126-156`, `tests/settings.test.ts:5` | conformant (kit); real session: user statement on 0.2.0 | TC-27 ran before T11 changed the band drawing |
| FR-23 | Modern drawing, `paneBackground`, `icons` | `pane.tsx:69-75,153-161`, `meter.tsx:8`, `icons.ts:9-19`, `register.tsx:194-195` | `tests/pane.test.ts:98,112`, `tests/band.test.ts:115` | not verifiable | Kit passes; real look, `claude --debug` and screenshots missing (CR-01) |
| NFR-01 | Supported API only | all hooks | QA-05, QA-06; `claude plugin validate` | conformant | No `@internal` member, no `node:*` |
| NFR-02 | No periodic disk read | `register.tsx:150-153` | `tests/register.test.ts:137` | conformant | Timer reads `$.state` only |
| NFR-03 | 4 MiB guard | `store.ts:109-114`, `register.tsx:91-92` | `tests/store.test.ts:80` | conformant | `deny` before `writeFile`; no kit test of "no write" (optional) |
| NFR-04 | Icon and word per kind, no animation | `icons.ts:9-22` | `tests/pane.test.ts:67` | non-conformant (partial) | CR-03 |
| NFR-05 | Narrow widths | `pane.tsx:148`, `band.tsx:28-30` | `tests/band.test.ts:84`, `tests/pane.test.ts:123` | conformant | Frame drop below 44 columns has no assertion (optional) |
| NFR-06 | English text | all mod files, README | review | conformant | — |
| NFR-07 | Windows, macOS, Linux | `platform.ts:7-12`, `store.ts:145-147`, `viewer.ts:11-23` | `tests/store.test.ts:90`, `tests/viewer.test.ts:30` | conformant (argv); real macOS/Linux not verifiable | README states it (`README.md:169`) |
| NFR-08 | Skills safe without the mod | `progress-report.md:7`, `relatorio-progresso.md:7` | TC-25 manual | conformant | TC-25: user statement only (W-10) |
| NFR-09 | Validate and test pass | — | commands below | conformant | Run in this review |
| OBJ-01 … OBJ-04, US-01 … US-08 | Outcomes and stories | as the FR rows | TC-22 … TC-25 | conformant except the FR-10/FR-12 gaps | Manual evidence is a user statement (W-10) on 0.2.0 |
| T09.6 | Screenshots of the T11 drawing, tested version | `feature-progress/README.md:7-11` (badge 2.1.310) | — | pending | `feature-progress/images/` does not exist (CR-01) |

## Compliance with rules and skills

| Rule or skill | State | Evidence |
| --- | --- | --- |
| `AGENTS.md` mod layout, marketplace, root README row, validate/test | OK | `.claude-plugin/marketplace.json:21-25`; `README.md:20`; commands below |
| `AGENTS.md` version bump per user-facing change | OK | `plugin.json` `0.3.0` (T10 0.2.0, T11 0.3.0) |
| `.agents/rules/mod-runtime.md` storage exception (DEC-01) | OK | `.agents/rules/mod-runtime.md:21` |
| `.agents/rules/pane-ui.md:15` (`claude --debug` after a drawing change) | NOT OK | No record after T11 (`done/task_09.md:91`) — CR-01 |
| `.agents/rules/pane-ui.md:38`, `tests.md:43` (screenshots, real look) | NOT OK | No `feature-progress/images/`; README has no screenshot — CR-01 |
| `.agents/rules/pane-ui.md` theme colors only | OK | Only hex value is the `paneBackground` option |
| `.agents/rules/javascript-typescript.md:44` (no floating promise) | NOT OK | `register.tsx:172,208` — CR-05 |
| TechSpec "Errors, security": flow text never in toasts | NOT OK | `register.tsx:210`, `viewer.ts:43` — CR-04 (`viewer.ts:37` is required by FR-15) |
| `ts-tests` depth | OK | 81 tests, TC-01 … TC-19, TC-26, TC-28 cases present |

## Quality profile

| ID | Rule | Class | Command | Hits | State |
| --- | --- | --- | --- | --- | --- |
| QA-01 | `any` | blocking | TechSpec QA-01 over 24 TS files | 0 | OK |
| QA-02 | `@ts-ignore` etc. | blocking | TechSpec QA-02 | 0 | OK |
| QA-03 | empty `catch` | blocking | TechSpec QA-03 | 0 | OK |
| QA-04 | shell command string | blocking | TechSpec QA-04 | 8 matches: `store.ts:146`; `viewer.ts:12,19`; 5 test assertions of the same argv | justified by DEC-05 (`store.ts`) and DEC-08 (`viewer.ts`, same shape as `session-info/hooks/viewer.ts:45,58`); `viewer.ts:19` also guards `cmd` syntax (`viewer.ts:8,42`) |
| QA-05 | `$` or a `'claude-code'` value in a helper | blocking | TechSpec QA-05 | 1 match: `icons.ts:1` `import type { Color } from 'claude-code'` | OK: a type-only import is not a value; `javascript-typescript.md:22` requires engine types from `'claude-code'` |
| QA-06 | `node:*`, timers | blocking | TechSpec QA-06 | 0 | OK |
| QA-07 | `console.*` | blocking | TechSpec QA-07 | 0 | OK |
| QA-08 | `throw new Error(` in a hook path | reservation | TechSpec QA-08 | 6 matches, all in `tests/` fakes | OK: 0 in a hook path |
| QA-09 | clock in a helper | reservation | TechSpec QA-09 | 0 | OK |
| QA-10 | 4+ parameters | reservation | TechSpec QA-10 | 11 matches; 3 real: `meter.tsx:8`, `tests/band.test.ts:29`, `tests/pane.test.ts:64` (others are 2-3 parameters with commas inside generics or destructuring) | 3 new reservation hits (optional improvement) |
| QA-11 | file above 500 lines | reservation | TechSpec QA-11 | 0 (largest: `tests/pane.test.ts` 262) | OK |

- Terrain baseline: applied from the TechSpec (new files only; no TypeScript target pre-exists).
- Hits discounted by baseline: 0.
- Reservations accumulated in the feature: 3.
- Suggested escalation: no trigger fired (8+ reservations, a file above 800 lines, or a block duplicated 3+ times: none).

## TechSpec adherence

| Decision or contract | State | Evidence |
| --- | --- | --- |
| DEC-01 | YES | `mod-runtime.md:21`; writes only `<id>.json` |
| DEC-02 | YES | `register.tsx:227`; `tests/register.test.ts:95` |
| DEC-03 | YES | `register.tsx:86-96`; `tests/register.test.ts:105` |
| DEC-04 | YES | `report.ts:7,15,120,133-137`; task-id check omits C1 controls U+0080-U+009F (optional) |
| DEC-05 | YES | `store.ts:146`, `register.tsx:132-133`; folder only as `cwd` |
| DEC-06 | YES | `register.tsx:159-181`; `tests/band.test.ts:68` |
| DEC-07 | YES | `report.ts:208`, `register.tsx:89` |
| DEC-08 | YES | `viewer.ts:11-48` (adds `exists` and `CMD_SYNTAX` guards; waits on `host.run` where session-info spawns) |
| DEC-09 | YES | `register.tsx:71-79,185`; `tests/register.test.ts:151` |
| DEC-10 | PARTIAL | `register.tsx:150` discards the `$.clock.every` handle; Integrations row says "handle kept" |
| DEC-11, DEC-12 | YES | one protocol file per variant; no `qa` row in Portuguese |
| DEC-13 | YES | `settings.ts:25-35`, `register.tsx:118-123,160` |
| DEC-14 | PARTIAL | Kit covers background, icon sets, narrow band; hover border and real paint not verifiable |
| `$.state` contract | PARTIAL | TechSpec lists `isPaneOpen: boolean`; code has `toggled: string[]` (`types/index.d.ts:46`) and reads `$.ui.panes()` — CR-06 |
| Command flow (clean takes done features from `$.state`) | PARTIAL | `register.tsx:127` reloads the folder first; safer, not periodic; no finding |
| Contracts: `""` clears | PARTIAL | `report.ts:56` also clears whitespace-only text (optional) |

## Verified tasks

| Task | Location | State | Handoff and evidence |
| --- | --- | --- | --- |
| T01 | `done/task_01.md` | COMPLETE | 6/6 ticked; validate, 23 tests, `tsc` |
| T02 | `done/task_02.md` | COMPLETE | 5/5; 43 tests; hand-written `claude-code-mcp` types (limitation) |
| T03 | `done/task_03.md` | COMPLETE | 5/5; 54 tests |
| T04 | `done/task_04.md` | COMPLETE | 4/4; 62 tests; `isPaneOpen` changed to `toggled` without a TechSpec record (CR-06) |
| T05 | `done/task_05.md` | COMPLETE | 4/4; 71 tests; new `platform.ts` |
| T06 | `done/task_06.md` | COMPLETE | 3/3; screenshots deferred to T09 |
| T07 | `done/task_07.md` | COMPLETE | 3/3; Git-ignored `.agents/` (AUTO-03) |
| T08 | `done/task_08.md` | COMPLETE | 5/5; commit `8bad3bd`, PR #18 merged as `f25a71c`; handoff predates the merge |
| T09 | `done/task_09.md` | INCOMPLETE | T09.6 ticked (`:52`) while the handoff keeps it open (`:87,:91`); `tasks.md` State `[x]` with "pending manual acceptance" — CR-01 |
| T10 | `done/task_10.md` | COMPLETE | 5/5; 75 tests; its `tsc` ran with TypeScript 5.6.3 (superseded by this review's 7.0.2 run) |
| T11 | `done/task_11.md` | COMPLETE (code); real look pending in T09 | 5/5; 81 tests; version 0.3.0 |

## Executed validations

- Profile and scope: surfaces `terminal` and `desktop` through the kit; Windows 11 local; real-session scope per `.agents/rules/tests.md` not run by this reviewer (a subagent has no interactive terminal).
- Validated state: worktree at base `e58daa9` with the uncommitted mod, Claude Code 2.1.310, TypeScript 7.0.2, Windows 11 Pro 10.0.26200.
- Reused evidence: TC-22 … TC-25 and TC-27 from W-10 (user statement, no per-TC log, mod version 0.2.0, another repository); reused for flow, reload, Refresh and skill logic that T11 did not change; not reused for the T11 drawing.
- Manual acceptance: open — T09.6 and the T11 visual check (AUTO-06, W-11).

| Command | Result | Obligations covered |
| --- | --- | --- |
| `claude plugin validate .` | passed | NFR-09, CMP-16 |
| `claude plugin validate feature-progress` | passed (hooks-module advisory note only) | NFR-09, CMP-01 |
| `claude plugin test feature-progress` | passed: 81 pass, 0 fail, 9 files (log in the reviewer's scratchpad) | TC-01 … TC-19, TC-26, TC-28 |
| `tsc -p feature-progress` | passed (exit 0, TypeScript 7.0.2) | NFR-01 types |
| TechSpec QA-01 … QA-11 (scratchpad script `qp.sh`) | see Quality profile | QA-01 … QA-11 |
| `rg -n "progress-report.md" .agents/skills`; `git grep relatorio-progresso.md master -- SKILLS` | links in all 8 + 8 files | TC-20, TC-21 |
| `sha256sum prd.md techspec.md tasks.md` | equal to `approved_sources` | source integrity |

## Findings

| ID | Severity | Source | Evidence | Impact | Proven recommendation |
| --- | --- | --- | --- | --- | --- |
| CR-01 | High | T09.6, FR-23, `pane-ui.md:15,38`, `tests.md:43` | `done/task_09.md:52` ticks T09.6 with "screenshots open (AUTO-06)"; `:87` "T09.6 is open"; `:91` visual check of T11 (`claude --debug`, `icons` `nerd`/`emoji`, `paneBackground`) pending; `feature-progress/images/` does not exist; `tasks.md` State marks T09 `[x]`; T09.1 `claude --debug` has no recorded result; the real-session acceptance ran on 0.2.0, before T11 rewrote `band.tsx` and `pane.tsx` | Task state is inconsistent and the rule-mandated real-look evidence for the current drawing is missing; a refused render or a bad glyph width at 0.3.0 would go unseen. AUTO-06 is a process decision, not a `DEC-NN`, and W-11 itself keeps HIL 3 open | Run 0.3.0 in a real session with `claude --debug` (no `ui.render ... refused`), check `icons` `nerd`/`emoji` and `paneBackground`, add cropped screenshots in `feature-progress/images/` and the README, then tick T09.6 with that evidence; until then, untick T09.6 and keep T09 open |
| CR-02 | Low | FR-10 | `register.tsx:172` `onOpen: () => void togglePane($)`; `togglePane` closes an open pane (`register.tsx:102-106`) | Pressing the band while the pane is open closes it; FR-10 says the band opens the pane. `tests/pane.test.ts:180` covers only closed → open | Give the band an open-only action (open, or focus when open), and test the open-pane case |
| CR-03 | Low | FR-12, NFR-04 | `pane.tsx:86` draws `stageText(task)`, which is `label ?? state` (`progress.ts:23-26`); `icons.ts:8` says "the word is the kind itself", so a label hides it | A task with a `label` shows no word for its kind; the state then shows by glyph and color only. The test does not assert the task glyph or word | Draw the kind word (from `KIND_STYLE` or the state) next to the glyph, and show `label` in addition; assert glyph and word in `tests/pane.test.ts` |
| CR-04 | Low | TechSpec "Errors, security" | `register.tsx:210` `` `could not open ${link}.` ``; `viewer.ts:43` `` `${path} has a character cmd would read…` `` | Flow text reaches toasts, against the TechSpec rule (the FR-15 missing-file toast at `viewer.ts:37` is a required exception) | Remove the link text from these 2 toasts, or record the exception in the TechSpec |
| CR-05 | Low | `javascript-typescript.md:44` | `register.tsx:172` `void togglePane($)` and `register.tsx:208` `void update(...)`, both without `.catch` | A rejected open/close or state update becomes an unhandled rejection with no message | Add `.catch` with a toast or `() => undefined` per the rule |
| CR-06 | Low | TechSpec Contracts `$.state` | `types/index.d.ts:46` declares `toggled: string[]`; the TechSpec lists `isPaneOpen: boolean`; no TechSpec update or ADR records the change (T04 handoff) | The approved contract and the code differ; a later reader of the TechSpec gets the wrong state keys | Record the change in the TechSpec Contracts (pane state from `$.ui.panes()`, `toggled` for expanded cards) through the HIL |
| CR-07 | Low | CMP-16, FR-22 | `README.md:20` command column `` `/feature-progress [clean]` ``; the command's `argumentHint` is `[band|clean]` | The root Mods table omits the `band` argument | Change the cell to `` `/feature-progress [band|clean]` `` |

Optional improvements (no status effect):

- QA-10 reservations: `meter.tsx:8` (4 parameters), `tests/band.test.ts:29`, `tests/pane.test.ts:64`.
- DEC-10: keep the `$.clock.every` handle (`register.tsx:150`); whether a module reload after `/feature-progress band` disposes the old timer is not documented (`index.d.ts:3539-3546`).
- `report.ts:56` clears whitespace-only text; the contract clears only `""`.
- `report.ts` task-id control-character check misses U+0080-U+009F.
- Missing tests: kit "no `writeFile`" for NFR-03; pane stale marker (TC-17 asks band and pane); frame drop below 44 columns; narrow-terminal toast; command `description`/`argumentHint`.
- `viewer.ts:19` `cmd /c` without `/d` (clean uses `/d`); `register.tsx:133` drops the run error from the failure toast; "1 done features" grammar.

## Previous findings (re-review only)

| Review/ID | State | Current evidence |
| --- | --- | --- |
| — | — | First review |

## Limitations and open items

- Real-session checks not run by this reviewer: a delegated subagent has no interactive terminal for `AbovePrompt` and `Pane`. Affected: FR-23, DEC-14 hover, T09.6 (CR-01). Required decision: the user runs the T09.6 visual check.
- Manual acceptance TC-22 … TC-25 and TC-27 rests on a user statement (W-10) with no per-TC log, on mod version 0.2.0, in another repository with a large feature instead of the planned small one. Accepted as human evidence for logic that T11 did not change.
- `.agents/` is Git-ignored (`.gitignore:4`), so the T07 changes and the `mod-runtime.md` exception have no diff against the base; they were read from disk. The copies in ContextBrake, Herdr and TokenHound were not changed (AUTO-03).
- T08: branch `feat/relatorio-progresso` no longer exists locally or on the remote; PR #18 merged it into `master` (`f25a71c`). CMP-19 was read from `master` at `8bad3bd`. `Update-AllSkills.ps1` has not run, so other projects do not have the Portuguese changes yet.
- `feature-progress/.claude-plugin/types/` was copied from session-info and `claude-code-mcp/index.d.ts` written by hand (timestamps 08:08 and 08:12, never regenerated by a load); `tsc` passed against these copies.
- Extra file `tasks/prd-02-feature-progress/.claude/feature-progress/02-feature-progress.json`: written by the mod while the session working directory was the feature folder (no `.claude/feature-progress/` exists at the repository root). `folderOf` resolves from `$.session.cwd()` by design (FR-07); which session had that directory is not provable here. It is Git-ignored. If a Bash `cd` moves `$.session.cwd()`, reports split across folders; this is unverified.
- `context-snapshot.md` is behind (`covers_through` T09 open; T09 `[x]` in `tasks.md`); its next step brief was not used.
- macOS and Linux runs not verifiable; argv covered by unit tests only (README states it).

## Conclusion

The code meets most obligations: 81 kit and unit tests pass, both validations pass, `tsc` is clean, the quality profile has no unjustified blocking hit and 3 reservations, and both skill variants carry the report protocol. The status is REJECTED for 2 reasons from the skill's Status rule. First, T09 is in an inconsistent state: T09.6 is ticked while its handoff and W-11 keep it open (CR-01). Second, essential evidence is missing: `pane-ui.md` and `tests.md` require a `claude --debug` run and screenshots after a drawing change, and no real-session evidence exists for the 0.3.0 drawing. AUTO-06 is a process decision, not a `DEC-NN`, so it cannot cover pending acceptance. Third, FR-10 (CR-02) and FR-12 (CR-03) are non-conformant obligations; each one alone also makes the status REJECTED, so CR-01 is not the only blocker. CR-02 … CR-07 are Low findings (FR-10 and FR-12 non-conformance, rule deviations, a contract drift and a documentation cell) and go to `sdd-plan-corrections` with CR-01.
