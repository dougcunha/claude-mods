# Workflow — prd-01-visual-review

## Decisions

| ID | Date | Decision | Scope | Provenance |
| --- | --- | --- | --- | --- |
| W-01 | 2026-10-22 | Run the flow in `mode: auto`, decision log `autonomous-decisions.md` | Whole feature | Human: `/sdd-orchestrate-flow --prd prd-01-visual-review --mode auto` |
| W-02 | 2026-10-22 | Process level: full SDD. Triage did not run: PRD, TechSpec and tasks existed before the first checkpoint | Whole feature | Reconciled from existing artifacts |
| W-03 | 2026-10-22 | HIL 1: PRD approved | `prd.md` | Autonomous, AUTO-01 (the snapshot and TechSpec also record a user approval on 2026-10-22) |
| W-04 | 2026-10-22 | HIL 2: TechSpec and plan approved; implementation and corrections within the contract authorized; QA enabled | `techspec.md`, `tasks.md`, `task_01.md`–`task_07.md` | Autonomous, AUTO-02 |
| W-05 | 2026-10-22 | The manual-acceptance block of codereview_02 (T07.6 samples approval, desktop app, macOS/Linux, TC-18 network and session end, TC-19 real stacks and a second browser, live comment loop) is accepted as open manual acceptance owned by the user; the review cycle closes and the delegated QA runs now; the open items return at HIL 3 | Review cycle, QA, HIL 3 | Human: answer "Rodar QA agora (Recommended)" to the AUTO-15 escalation |
| W-06 | 2026-10-22 | HIL 3: delivery accepted. Accepted open items: the manual script of `qa_01/qa.md` (TC-19 real stacks and a second browser, hand-driven page loop and Copy review clipboard, full keyboard walk and contrast, desktop app, macOS/Linux, approval of the sample repositories), FR-14 sources without a real sample (Prisma, TypeORM, Drizzle, Django), `web/app.js` at 793 lines. ADR candidates: none | Whole feature | Human: answer "Aceitar agora" to HIL 3 (AUTO-16) |

## Base and pre-existing changes

- Git base: `8d5ddebde265db7378b7bb730671e34709905a23` (`main`).
- Pre-existing changes not from this feature, to preserve: `.gitignore` (context-brake block), untracked `skills-lock.json`.

## Recovery events

- 2026-10-22 11:48: no checkpoint existed; state reconciled from `prd.md`, `techspec.md`, `tasks.md` and `context-snapshot.md` (header valid at `8d5ddeb`). First checkpoint created.
- 2026-10-22 12:05: T01 completed (`done/task_01.md`). Environment change for real-session checks: `claude plugin install visual-review@claude-mods --scope local` (the clone is the `claude-mods` folder marketplace, as `AGENTS.md` describes). Autonomous decisions AUTO-04, AUTO-05, AUTO-06.
- 2026-10-22 12:20: T02 completed (`done/task_02.md`). Autonomous decisions AUTO-07, AUTO-08.
- 2026-10-22 12:45: T03 completed (`done/task_03.md`). Autonomous decision AUTO-09.
- 2026-10-22 13:00: T04 completed (`done/task_04.md`). Autonomous decision AUTO-10. The first real run left up to 3 File Explorer windows open on this machine (explorer.exe with the token URL).
- 2026-10-22 13:20: T05 completed (`done/task_05.md`). Visual check (TC-19 with real stacks) recorded as pending manual acceptance, per autonomous mode.
- 2026-10-22 13:45: T06 completed (`done/task_06.md`).
- 2026-10-22 13:50: session paused at ContextBrake RED (66%) before T07 started; snapshot written; checkpoint paused, safe to stop.
- 2026-10-22 13:55: Chrome check (claude-in-chrome, live server on the T03 real view model): page drawn, comment on a member saved, review submitted; fixed the always-visible comment form in style.css.
- 2026-10-22 13:26: session resumed from the paused checkpoint (generation 8); snapshot loaded at `8d5ddeb`. Autonomous decisions AUTO-11 (Copy review text in `web/review-text.js`), AUTO-12 (stale `.js` outputs deleted).
- 2026-10-22 13:45: autonomous decision AUTO-13: sample repositories `shop-cs` and `shop-py` built in the scratchpad for T07.6; their approval by the user, the desktop app, and macOS/Linux stay pending manual acceptance for HIL 3.
- 2026-10-22 13:55: T07 completed (`done/task_07.md`); every task is complete. The real runs opened up to 3 browser tabs on this machine. Next: global review delegated to a fresh-context reviewer in `codereview_01/`, base `8d5ddeb`.
- 2026-10-22 14:10: codereview_01 received: REJECTED, delegated reviewer, 11 findings (4 Medium, 7 Low), 1 block (T07.6 and the manual acceptance open). Worktree check: only `codereview_01/` and the coordinator's own checkpoint write changed. Correction round 1 opened (`sdd-plan-corrections`), authorized by W-04 within the contract.
- 2026-10-22 14:55: correction round 1 complete: T08–T17 in `codereview_01/done/` (CR-01 to CR-11; AUTO-14). Integrated state: `claude plugin validate .` and `visual-review` passed, 109 tests pass, `tsc` exit 0, quality profile 0 real hits. `web/app.js` has 793 lines (outside the TypeScript profile, near the 800-line trigger). The block of codereview_01 (T07.6, TC-18/TC-19 manual acceptance) stays open for HIL 3. Next: re-review delegated to a fresh-context reviewer in `codereview_02/`.
- 2026-10-22 15:05: codereview_02 received: REJECTED, delegated reviewer, 0 new findings, CR-01 to CR-11 resolved, 1 block (T07.6 and manual acceptance open, HIL 3). Worktree check: only `codereview_02/` and the coordinator's own checkpoint write changed. No correction round: the block needs the user. Escalated (AUTO-15): checkpoint `awaiting-hil`.
- 2026-10-22 15:10: the user answered the AUTO-15 escalation (W-05); QA delegated to a fresh-context QA runner in `qa_01/`.
- 2026-10-22 15:35: qa_01 received: BLOCKED, delegated QA runner, no BUG-NN; 5 real headless sessions passed (TS server loop with submit and rerun, not a repository, empty diff, C# static mode, Python server mode), TC-18 passed, 100-unit page under 1 s. Worktree check: only `qa_01/` and the coordinator's own checkpoint write changed. The block is the manual acceptance owned by the user (W-05). Escalated to HIL 3 (AUTO-16).
- 2026-10-22 15:40: HIL 3 accepted (W-06); checkpoint `completed`, snapshot `closed`. No commit: the `commit` skill runs only when the user asks.
