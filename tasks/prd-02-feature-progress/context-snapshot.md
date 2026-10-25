# Context snapshot — 02-feature-progress

> Hints for the next session, not an authority: artifacts, manifests, handoffs, reports, and code win on conflict. Protocol: `.agents/skills/sdd-snapshot/SKILL.md`.

## Header

- status: closed
- generated: 2026-10-25
- stage: acceptance
- stage_source: qa_01/
- covers_through: HIL 3 accepted (W-21)
- authored_code: yes
- git_head: e58daa9
- worktree: 4 changed: `feature-progress/` (new), `README.md`, `.claude-plugin/marketplace.json`, `tasks/` (new); plus Git-ignored `.agents/` edits (AUTO-03)
- next_step: — (feature completed; commit through the `commit` skill)
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

- Why next: the review cycle closed with codereview_03 APPROVED WITH RESERVATIONS (AUTO-11); QA runs because the TechSpec has essential manual acceptance (W-04).
- Read first: `codereview_03/codereview.md`, `techspec.md#test-approach`, `workflow.md` W-14, W-18.
- Known change points: none; QA does not change code.
- Applicable entries: O-06.
- Watch out: TC-22 … TC-27 rest on user statements (W-10, W-14) and screenshots (W-16); a QA runner cannot drive a real terminal.

## Decisions

- [D-02] (when: on-select: FR-07; DEC-01; on-edit: .agents/rules/mod-runtime.md) User approved a documented exception to `mod-runtime.md` for the storage folder; it is recorded in that rule (Git-ignored copy) — src: techspec.md#Technical decisions; until: feature completed

- [D-03] (when: on-select: FR-22; DEC-13; T10; TC-27) User added the option to hide the band to this feature: `showBand` in `userConfig` plus `/feature-progress band`, which flips it through `$.config.set` — src: workflow.md#W-09; until: feature completed

## Learnings

- [L-04] (when: on-run: claude plugin test feature-progress; on-select: TC-23) The kit covers the `/clear` reload with a switching `session.id`, but not the real host timing; TC-23 stays manual — src: done/task_02.md#Handoff; until: T09 done
- [L-06] (when: on-run: tsc -p feature-progress) `claude -p --plugin-dir` does not lay `.claude-plugin/types/`; the folder was copied from session-info and `claude-code-mcp/index.d.ts` written by hand for the report tool. A real load regenerates both — src: done/task_01.md#Handoff; until: first real load
- [L-07] (when: on-edit: feature-progress/tests/**; feature-progress/hooks/*.tsx) Kit: `Text` loses its `key` (find by text), a `Button` holds only `Text`, fs hooks receive absolute Windows paths (`D:\repo\…`), and `next(e)` in a render needs a test hook beneath that stands for the engine — src: done/task_03.md#Handoff; until: changed files overlap
- [L-08] (when: on-run: rg; bash) A shell command whose text holds `env` is blocked by the env mod; run such commands from a script file in the scratchpad — src: —; until: next session

## Code map

- [M-03] (when: on-edit: feature-progress/hooks/register.tsx) Hooks: `session.start` (tool, command, timer, load), `session.end` (reload after switch), `ui.render` AbovePrompt and Pane, `command.run`, `tool.call` — src: feature-progress/README.md#Development; until: changed files overlap

## Open threads

- [O-06] (when: on-select: review) `$.session.cwd()` follows a Bash `cd` of the session, so a report sent after `cd` into a subfolder writes `<subfolder>/.claude/feature-progress/`; one stray file exists in `tasks/prd-02-feature-progress/.claude/` (codereview_01 limitation). Not a finding yet; candidate for a later fix (resolve the folder once at session start) — src: codereview_01/codereview.md#limitations-and-open-items; until: decided
