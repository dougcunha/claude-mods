# QA report — feature-progress (02-feature-progress)

## Summary

- Status: BLOCKED
- Execution: delegated QA runner (fresh-context subagent, same worktree, direct searches only, no explorers)
- Code state: `e58daa9d268f1dfe8119c5bdfa0716690b9babe0..worktree`, nothing committed (`M .claude-plugin/marketplace.json`, `M README.md`, `?? feature-progress/`, `?? tasks/`); mod `0.3.0`. No file under `feature-progress/` changed after `codereview_03/codereview.md` (modification-time listing); only SDD artifacts changed after it.
- Latest review: `codereview_03/codereview.md` (APPROVED WITH RESERVATIONS; reservations routed by AUTO-11, W-18)
- Previous QA: —

## Environment

| Item | Value |
| --- | --- |
| Claude Code | `2.1.310 (Claude Code)` (`evidence/claude-version.log`) |
| Mod version | `0.3.0` (`feature-progress/.claude-plugin/plugin.json`) |
| Platforms | Windows 11 Pro 10.0.26200 ran. macOS and Linux could not run (no host). |
| Validation commands | `claude plugin validate .`: passed (`evidence/validate-root.log`). `claude plugin validate feature-progress`: passed, with 1 plugin-directory warning `ICON_MISSING`, which is not a validation failure (`evidence/validate-mod.log`). `claude plugin test feature-progress` (1 run): 85 pass, 0 fail, 9 files, exit 0 (`evidence/plugin-test.log`). `tsc -p feature-progress`: exit 0, TypeScript 7.0.2 (`evidence/tsc.log`). |
| Mod load route | `claude plugin list` shows `feature-progress@claude-mods` 0.3.0 enabled at user scope, read from `D:\MyProjects\claude-mods\feature-progress` (`evidence/plugin-list.log`). The runs use this install, not `--plugin-dir`, because a `--plugin-dir` copy of the same folder loads a second module and disabling the install changes user settings. Each debug excerpt shows `hooks module feature-progress@claude-mods loaded` once. |
| Working directory | `C:/Users/Admin/AppData/Local/Temp/claude/D--MyProjects-claude-mods/3ed6a7fd-8dea-4a05-98a8-10103726ae6d/scratchpad/qa01-run` (new Git repository with 1 `README.md`) |
| Run helper | `C:/Users/Admin/AppData/Local/Temp/claude/D--MyProjects-claude-mods/3ed6a7fd-8dea-4a05-98a8-10103726ae6d/scratchpad/qa01-run.sh`; full debug logs in `…/scratchpad/qa01-debug/`, excerpts (`feature-progress` lines) in `evidence/*.debug-excerpt.log` |

## Acceptance checklist

Routes: `real-session` = headless `claude -p` run in this QA; `unit`/`kit` = `evidence/plugin-test.log` on the same code state; `review` = read or `rg` evidence; `manual` = the user's real terminal.

| Obligation | Test cases | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| FR-01 tool registered, description states the contract | TC-05 | real-session + kit | PASSED | `mcp__feature-progress__report` in the `init` tools of every run (`evidence/r01-create.stdout.jsonl`); exact description text: kit TC-05 `session start registers the report tool with the exact description` |
| FR-02 merge by field and task id | TC-02, TC-12 | real-session + unit + kit | PASSED | R02: `{T01 state done}` keeps `title`, `steps`, `note`, `link` (`evidence/r02-qa-demo.json`); R03 adds T03, T04 after T01 in order received (`evidence/r03-qa-demo.json`); each run is a new session, so the merge reads the disk (DEC-03) |
| FR-03 `remove`, unknown id ignored | TC-03 | real-session + unit | PASSED | R03 `remove: ["T02","T99"]`: T02 gone, no error, count `1/3` (`evidence/r03-qa-demo.json`) |
| FR-04 title required on create, field named | TC-01, TC-02 | real-session + unit | PASSED | R04 B: `feature-progress: tasks T05 needs a title, because it is a new task`; R04 C: `feature.title is required for a new feature`; no `qa-new.json`; `qa-demo.json` sha256 equal before and after (`evidence/r04-*`) |
| FR-05 9 kinds, default `pending` | TC-01 | real-session + unit | PASSED | R04 A: message lists the 9 kinds; R01 T02 stored as `pending` |
| FR-06 timestamps | TC-04 | real-session + unit | PASSED | R02 T01 `startedAt` ≤ `finishedAt`; R03 `done → fixing` clears `finishedAt`, keeps `startedAt` |
| FR-07 storage folder from `userConfig` | TC-09 | real-session + unit | PASSED | Default folder: `<cwd>/.claude/feature-progress/<id>.json` created by R01. Changed option: unit TC-09 and settings tests only (changing the option needs a user-setting change, not done) |
| FR-08 reply text or error | TC-05, TC-06 | real-session + kit | PASSED | `feature-progress: active · 0/2`, `review #2 · 1/2`, `fixing #1 · 1/3`, `done · 1/1`; errors as `is_error` results |
| FR-09 band shows latest open feature | TC-08, TC-14 | kit + manual | PASSED | kit TC-14 terminal and desktop; `feature-progress/images/band.png` (user, 0.3.0, W-16) |
| FR-10 band press and command toggle | TC-15 | kit + manual | NOT VERIFIABLE | kit TC-15 (3 cases) passed. `togglePane`/`openPane` changed in T13 after the user's 0.2.0 run; no 0.3.0 run of the toggle is recorded |
| FR-11 pane order and Done section | TC-08, TC-16 | kit + manual | PASSED | kit TC-16 terminal and desktop; `images/pane-unicode.png` (user, 0.3.0, W-14) |
| FR-12 task rows, groups, steps bar | TC-08, TC-16 | real-session (data) + kit + manual | PASSED | R03 and R08 store `group` `Review #1`; kit TC-16 and the `FR-12 NFR-04` cases; pane screenshots (W-14) |
| FR-13 count includes corrections | TC-06 | real-session + unit | PASSED | R03 `1/3`, R08 `1/3` after a correction task; unit TC-06 `12/17` |
| FR-14 stale marker, timer without disk | TC-07, TC-17, TC-13 | unit + kit | PASSED | TC-07, TC-17, TC-13 `timer ticks read nothing more` |
| FR-15 link control with `editor` | TC-18 | unit + kit | PASSED | TC-18 (5 cases) and `pressing a task link opens its file`; a real open needs the user's desktop |
| FR-16 load at start and Refresh only | TC-13, TC-24 | kit + manual | NOT VERIFIABLE | kit TC-13 and TC-15 `Refresh reads the folder once more`; TC-24 ran on 0.2.0 only (see Manual acceptance) |
| FR-17 clean done features | TC-11, TC-19 | unit + kit; real-session tried | PASSED (kit) | R06 `claude -p "/feature-progress clean"`: the prompt reached the model as text, no command ran, `qa-done.json` stayed (`evidence/r06-*`). The kit TC-19 and TC-11 pass |
| FR-18 unreadable file | TC-09, TC-12, TC-16 | real-session + unit + kit | PASSED | R05 A: `… bad.json is not a readable feature file; fix or delete it, then report again`; `bad.json` sha256 equal before and after (`evidence/r05-bad-sha-*.txt`); warning row: kit TC-16 |
| FR-19 skills report at state changes, both variants | TC-20, TC-21 | review | PASSED | `rg` lists `progress-report.md` in the 8 English files of CMP-18 and `relatorio-progresso.md` in the 8 Portuguese files of CMP-19 (`evidence/tc20-rg.txt`, `tc21-rg.txt`); the Portuguese branch is merged to `master` (`f25a71c`) |
| FR-20 state mapping and order in a real run | TC-20, TC-21, TC-22 | review + manual | NOT VERIFIABLE | review part passed; Mapping rows and "no `qa`" line (`evidence/tc20-21-protocol.txt`); TC-22 ran on 0.2.0 only |
| FR-21 README contract for other flows | review, OBJ-02 | real-session + review | PASSED | R08 sends the 3 README example calls verbatim; all succeed (`active · 0/2`, `active · 1/2`, `fixing #1 · 1/3`, `evidence/r08-*`); README has the input, merge rules, states, `.gitignore` and stored-file sections (`evidence/static-checks.txt`) |
| FR-22 `showBand` and `/feature-progress band` | TC-26, TC-27 | kit + manual | NOT VERIFIABLE | kit TC-26 (4 cases) passed. Not run here: the command writes a user setting through `$.config.set`. TC-27 ran on 0.2.0 only |
| FR-23 modern look, `paneBackground`, `icons` | TC-28 | kit + manual | PASSED | kit `paneBackground` (terminal and desktop), `icons option draws the glyph of its set`; user 0.3.0 check of `nerd`, `paneBackground` and `claude --debug` with no refused render (W-14); pane screenshots in 3 icon sets; no emoji band screenshot (accepted open item, AUTO-11) |
| DEC-02 subagent call ignored | TC-05 | real-session + kit | PASSED | R07: the report call has `parent_tool_use_id` set, the result is `Ignored: only the main session reports progress.`, no `qa-sub.json`, `qa-demo.json` sha256 unchanged (`evidence/r07-*`) |
| OBJ-01 stage and tasks visible during a flow | TC-22 | manual | NOT VERIFIABLE on 0.3.0 | See Manual acceptance |
| OBJ-03 / US-05 survives `/clear`, resume, new session | TC-13, TC-23 | real-session (disk) + kit + manual | NOT VERIFIABLE | disk and kit parts passed; Every headless run is a new session that merges into the stored file. Band and pane redraw after `/clear` rest on kit TC-13 `DEC-09 after /clear`, which does not reproduce host timing (TechSpec Risks) |
| OBJ-04 / NFR-08 skills without the mod | TC-20, TC-21, TC-25 | review + manual | PASSED | Skip rule in both protocol files, line 7 (`evidence/tc20-21-protocol.txt`); TC-25 by the user on 0.2.0, reused because no mod code runs with the mod disabled and the skill text is unchanged since (see Manual acceptance) |
| US-06 two sessions with Refresh | TC-24 | kit + manual | as FR-16 | — |
| NFR-01 supported API only | review | review | PASSED | `rg "@internal\|bashEditDiff\|node:\|require\("` in `feature-progress/hooks`: no hit (`evidence/static-checks.txt`); the validator's call list names only documented `$` members (`evidence/validate-mod.log`) |
| NFR-02 no periodic disk read | TC-13 | kit | PASSED | kit TC-13 |
| NFR-03 4 MiB guard | TC-10 | unit | PASSED | unit TC-10 |
| NFR-04 icon and word per kind | TC-16 | kit | PASSED | kit `FR-12 NFR-04` and `NFR-04 a task stage keeps the word` |
| NFR-05 narrow widths | TC-14, TC-28 | kit | PASSED | kit `NFR-05` cases (band and pane) |
| NFR-06 English text | review | review | PASSED | Tool messages in R01 … R08 and the README are English; flow values shown as received |
| NFR-07 Windows, macOS, Linux | TC-11, TC-18 | real-session + unit | NOT VERIFIABLE (macOS, Linux); Windows passed | argv per platform: unit TC-11, TC-18 |
| NFR-09 quality gate | — | commands | PASSED | Environment row above |

## Real-session runs

Each command is in `evidence/<run>.cmd.txt` and the prompt in `evidence/<run>.prompt.txt`. Base form: `claude -p "<prompt>" --output-format stream-json --verbose --allowedTools mcp__feature-progress__report --max-turns 4 --no-session-persistence --debug-file <file>`, run in the throwaway directory. stderr of R02, R03 and R07 holds only the CLI note `no stdin data received in 3s`; the others are empty. No debug excerpt has `refused` or a `feature-progress` error.

| Scenario | Surface | Command | Exit code | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| R01 create feature with 2 tasks (FR-01, FR-05, FR-07, FR-08) | headless | `qa01-run.sh r01-create …` | 0 | PASSED: `feature-progress: active · 0/2`; file created | `evidence/r01-*` |
| R02 merge one task state (FR-02, FR-06, FR-08) | headless | `qa01-run.sh r02-merge …` | 0 | PASSED: `review #2 · 1/2`; other fields kept | `evidence/r02-*` |
| R03 groups, remove, `done → fixing` (FR-03, FR-06, FR-12, FR-13) | headless | `qa01-run.sh r03-group-remove …` | 0 | PASSED: `fixing #1 · 1/3` | `evidence/r03-*` |
| R04 3 invalid calls (FR-04, FR-05, FR-08) | headless | `qa01-run.sh r04-invalid …` | 0 | PASSED: 3 `is_error` results naming the field or the 9 kinds; file unchanged | `evidence/r04-*` |
| R05 unreadable file and a done feature (FR-18) | headless | `qa01-run.sh r05-unreadable-done …` | 0 | PASSED: refused, bytes unchanged; `done · 1/1` | `evidence/r05-*` |
| R06 `/feature-progress clean` (FR-17) | headless | `qa01-run.sh r06-clean '/feature-progress clean'` | 0 | NOT VERIFIABLE: the plugin command did not dispatch in `-p`; the model answered the text; files unchanged | `evidence/r06-*` |
| R07 report from a subagent (DEC-02) | headless | `claude -p … --allowedTools Agent mcp__feature-progress__report …` | 0 | PASSED: `Ignored: …`, nothing written | `evidence/r07-*` |
| R08 the 3 README examples (FR-21, OBJ-02) | headless | `qa01-run.sh r08-readme-examples …` | 0 | PASSED: 3 valid replies | `evidence/r08-*` |
| Writes outside the mod folder | headless | `git status --porcelain --untracked-files=all` after each run; worktree `git status --porcelain` after all runs | — | PASSED: the throwaway repository shows only `.claude/feature-progress/*.json` plus the files QA created (`README.md`, `bad.json`); the worktree status equals the baseline | `evidence/*.git-status.txt`, `evidence/worktree-status-after-runs.txt` |

## Manual acceptance

This runner has no interactive terminal; it ran no manual script. The rows weigh the user's recorded results.

| Script | Executed by | Observed result | Status |
| --- | --- | --- | --- |
| TC-22 flow run planning → … → done | user, mod 0.2.0, Claude Code 2.1.310, Windows (W-10, `done/task_09.md:89-90`) | "OK", no per-TC log. On 0.3.0 the band screenshot (W-16) shows a real flow feature at `waiting` `26/29` | NOT VERIFIABLE on 0.3.0 |
| TC-23 `/clear` and `/resume` reload | user, 0.2.0 (W-10) | "OK", no log | NOT VERIFIABLE on 0.3.0 |
| TC-24 Refresh across 2 sessions | user, 0.2.0 (W-10) | "OK", no log | NOT VERIFIABLE on 0.3.0 |
| TC-25 skill run without the mod | user, 0.2.0 (W-10) | "OK", no log | PASSED by reuse: the path is skill text only, unchanged since (T08 merged) |
| TC-27 band hide, `/clear`, show | user, 0.2.0 (W-10) | "OK", no log | NOT VERIFIABLE on 0.3.0 |
| T09.1 / T12.2 `claude --debug`, `icons`, `paneBackground` | user, 0.3.0 (W-13, W-14) | no `ui.render … refused`; `nerd` and `paneBackground` OK; 3 pane screenshots | PASSED |
| Band real look | user, 0.3.0 (W-16, W-17) | `feature-progress/images/band.png` | PASSED (`unicode` set only) |

Reason for the 0.3.0 gap: after the user's 0.2.0 run, `register.tsx` changed in T11 (settings and drawing), codereview_01/T13 (`togglePane`, `openPane`, band press), T14 (`.catch` on the `/clear` poll and the toggle update) and T16 (link toasts). TC-23, TC-24, TC-27 and the FR-10 toggle exercise these paths. The 0.3.0 user check (W-14) covers only debug output, glyphs, background and screenshots.

## Findings

No `BUG-NN`. No observed result differs from an obligation.

Observations with no status effect:

- R04 B message says `tasks T05 needs a title`; the field is named, as FR-04 requires. The wording `tasks T05` reads as a plural; `task T05` is clearer.
- The stray file `tasks/prd-02-feature-progress/.claude/feature-progress/02-feature-progress.json` (08:45, open thread O-06) exists before this run; no QA run wrote in the worktree.

## Previous findings (re-run only)

Not applicable: first QA run.

## Limitations and open items

- BLOCK: TC-22, TC-23, TC-24 and TC-27 (OBJ-01, OBJ-03, FR-10 toggle, FR-16 / US-06, FR-20 order, FR-22 real session) have real-session evidence only for 0.2.0. `register.tsx` changed after it (T11, T13, T14, T16). Required: the user reruns these 4 scripts on 0.3.0 in a real terminal and records the observed states.
- FR-17 clean: a plugin command does not dispatch in `claude -p`, so the real delete ran only in the kit (TC-19) and unit argv (TC-11). The user's TC-22 … TC-27 script does not cover `/feature-progress clean`; a real run on Windows is still open.
- FR-15 link open and FR-22 `/feature-progress band`: not run, because they start a desktop program or write a user setting; kit only.
- FR-07 changed folder option: not run in a real session (needs a user-setting change); unit only.
- The runs load the mod through the existing user-scope install that reads this worktree folder, not through `--plugin-dir`; other installed mods ran in the same sessions (`cc-plugin-sec-default` admitted `feature-progress`).
- The band and pane drawing cannot show in a headless run; the drawing evidence is kit plus the user's 0.3.0 screenshots. No emoji band screenshot (accepted open item, AUTO-11).
- macOS and Linux: not run (NFR-07); argv by unit tests only.
- Independence: this runner did not write the mod code. The snapshot says `authored_code: yes` for the coordinator session; this runner loaded only its header, next step brief, open threads and `on-run` entries.

## Conclusion

The checks pass: both validations, 85 kit and unit tests, `tsc`, and 8 headless runs that cover the tool contract, merge, remove, timestamps, errors, unreadable files, subagent calls and the README examples. No defect was found. The status is BLOCKED because essential manual scripts TC-22, TC-23, TC-24 and TC-27 have results only for mod 0.2.0. The hooks module changed after that run, in the reload, toggle and settings paths that these scripts exercise. A rerun of these 4 scripts on 0.3.0 by the user, plus one real `/feature-progress clean`, gives the evidence for a new QA run.
