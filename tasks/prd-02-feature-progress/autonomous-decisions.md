# Autonomous decisions — 02-feature-progress

## AUTO-01 — ContextBrake check — 2026-10-25 00:00

- Question: Is ContextBrake configured for automatic restarts that resume this flow?
- Options: A (recommended) — proceed; B — suggest `npx context-brake init …`
- Choice: A
- Reason: `context-brake.config.json` has `activeHarnesses: ["claude-code"]`, `autoRestart.maxConsecutiveRestarts: 10`, `snapshot.command: sdd-snapshot`, `snapshot.resumeCommand: sdd-orchestrate-flow`. No warning.
- Reversal: none needed.

## AUTO-02 — Scope of escalations known at start — 2026-10-25 00:00

- Question: Which planned units need the user before they can finish?
- Options: A (recommended) — run T01 … T08 autonomously and escalate at T08.5 (push and PR, external action) and T09 (essential manual validation in a real session); B — escalate now
- Choice: A
- Reason: escalation rubric items "external action not authorized" (W-04) and "essential manual validation, with no other eligible unit"; every other unit has an approved contract.
- Reversal: the user can answer at any escalation point.

## AUTO-03 — T07 / where the English skills live — 2026-10-25

- Question: `.agents/` is in the root `.gitignore`, and the same English SDD skills also exist as separate copies in `D:/MyProjects/ContextBrake`, `D:/MyProjects/Herdr` and `D:/MyProjects/TokenHound`. Change only this repository's copy?
- Options: A (recommended) — change `D:/MyProjects/claude-mods/.agents/skills` as T07 states, and record that the change is local and does not reach the other copies; B — also change the 3 other copies (outside the approved scope); C — escalate
- Choice: A
- Reason: T07 and CMP-18 name only this repository's files; changing other repositories widens the scope (escalation rubric). The change is reversible.
- Reversal: delete `progress-report.md` and the link sentences, or copy the files to the other projects later.

## AUTO-04 — Escalation after T08 — 2026-10-25

- Question: push `feat/relatorio-progresso` and open its PR; run T09 (install the mod with `--scope user` and run the manual script TC-22 … TC-25 in `D:/MyProjects/claude-mods`); or change the plan so the code review runs before T09.
- Options: see the question asked in the session.
- Escalated: "triggers an external action not authorized in the request" (push, PR) and "depends on essential manual validation, with no other eligible unit" (T09).
- Reason: T01 … T08 are done; `delegated-review.md` step 1 delegates the review only when every task is complete.
- Reversal: none needed; nothing ran.

## AUTO-05 — Escalation: new scope (hide the band) — 2026-10-25

- Question: the user asked for an option to hide the band while T09 waits; add it to this feature or to a later one, and in which form?
- Options: add to this feature (FR-22, T10) or a later feature after acceptance; `userConfig` plus a command, `userConfig` only, or a session-only command.
- Escalated: "changes the approved PRD scope" and "`userConfig` defaults" (rubric). Answer recorded in `workflow.md#W-09`.
- Reversal: none needed.

## AUTO-06 — Visual check and T09.6 screenshots — 2026-10-25

- Question: the T11 drawing needs a visual check in a real session and T09.6 needs cropped screenshots; wait for the user, or record them as pending manual acceptance and go on to the review?
- Options: A (recommended) — close T09 with the screenshots and the visual check as an open item, delegate the review of T01 … T11 now; B — wait for the user before the review.
- Choice: A.
- Reason: `autonomous-mode.md` Gates, "Visual check: records the script as pending manual acceptance and proceeds to the review"; the badge already matches `claude --version` (2.1.310); TC-22 … TC-25 and TC-27 passed in the user session (W-10). Automatic acceptance stays blocked until the visual check is done.
- Reversal: none; the screenshots and the check are added later without a code change.

## AUTO-07 — Review codereview_01 REJECTED: correction round 1 — 2026-10-25

- Question: route the REJECTED review; how to handle CR-01, whose evidence needs the user's real terminal?
- Options: A (recommended) — plan T12 … T18, run T13 … T18 and T12.1 now, escalate T12.2 (real-session check and screenshots) once no other unit is eligible; B — escalate at once.
- Choice: A.
- Reason: `sdd-orchestrate-flow` step 5 (`REJECTED` opens a correction round); rubric "depends on ... essential manual validation, with no other eligible unit" applies only after the other tasks; CR-01 cites `pane-ui.md:15,38` and `tests.md:43`.
- Reversal: none; the tasks are plans in `codereview_01/`.

## AUTO-08 — CR-06: the TechSpec follows the code for the pane state — 2026-10-25

- Question: CR-06 says the TechSpec `$.state` contract (`isPaneOpen`) differs from the code (`toggled`, `$.ui.panes()`); change the code or the TechSpec?
- Options: A (recommended) — edit the TechSpec contract to the code; B — add `isPaneOpen` to the code.
- Choice: A.
- Reason: `$.ui.panes()` is the engine's own answer, so it cannot drift after `/clear` (DEC-09 resets `$.state`); the T04 handoff records the change; no persisted format changes (`$.state` lives one session). Reversible by restoring the TechSpec rows.
- Reversal: restore the rows; no code impact.

## AUTO-09 — Escalation: real-session check of 0.3.0 (codereview_01/task_12) — 2026-10-25

- Question: T12.2 needs `claude --debug` with version 0.3.0, a check of `icons` and `paneBackground`, and 2 cropped screenshots; who runs it?
- Options: A (recommended) — the user runs it and sends the screenshots; B — the user waives the screenshots and accepts the open item.
- Escalated: "depends on ... essential manual validation, with no other eligible unit" (T13 … T18 are done; the re-review waits for T12).
- Reversal: none needed.

## AUTO-10 — Review codereview_02 REJECTED: correction round 2 — 2026-10-25

- Question: route the REJECTED re-review (CR-01 Medium: no band screenshot; CR-02 Low: label text in README and TechSpec).
- Options: A (recommended) — plan T19 and T20, do T20 now, escalate T19 to the user; B — escalate both.
- Choice: A; T19 escalated: "depends on ... essential manual validation, with no other eligible unit".
- Reason: findings went from 7 to 2, so the round made progress (no stagnation); T20 is documentation inside the contract.
- Reversal: none.

## AUTO-11 — Reservations of codereview_03 — 2026-10-25

- Question: codereview_03 is APPROVED WITH RESERVATIONS; correct which items?
- Options: A (recommended) — correct the documentation items inside the contract (2 stale handoff sentences, 1 line reference, TechSpec Command flow text) and accept the rest; B — accept all.
- Choice: A. Accepted open items: QA-10 reservations (3, test and drawing helpers with 4 parameters); `plugin.json` stays `0.3.0` because 0.3.0 is not released yet (nothing committed; the folder marketplace reads the folder); no emoji band screenshot (kit case and `pane-emoji.png` cover it); stray file O-06 and the `$.session.cwd()` behavior after a Bash `cd`.
- Reason: `autonomous-mode.md` Gates, Reservations; none of the items touches a requirement, security or essential evidence (codereview_03 Conclusion).
- Reversal: the accepted items can become tasks later.

## AUTO-12 — QA qa_01 BLOCKED: escalation — 2026-10-25

- Question: qa_01 is BLOCKED: TC-22, TC-23, TC-24 and TC-27 have real-session results only on 0.2.0, and `/feature-progress clean` has no real run; who closes them?
- Options: A (recommended) — the user reruns the 4 scripts and 1 clean on 0.3.0, then a new QA run `qa_02`; B — the user accepts the current evidence at HIL 3.
- Escalated: "depends on ... essential manual validation, with no other eligible unit"; QA `BLOCKED` row of the Gates table.
- Reversal: none needed.
