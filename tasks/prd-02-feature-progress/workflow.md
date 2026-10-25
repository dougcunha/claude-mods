# Workflow — 02-feature-progress

## Git base

- Base commit: `e58daa9d268f1dfe8119c5bdfa0716690b9babe0` (`main`).
- Pre-existing changes at flow start: only the untracked folder `tasks/` (this feature's artifacts). No other change in the worktree.
- Second repository touched by T08: `D:\Projetos\agents-instructions` (branch `master`, clean at planning time).

## Decisions

### W-01 — Process level — 2026-10-24

- Decision: full SDD flow (grilling → PRD → TechSpec → tasks → implementation → review → QA). No `sdd-triage` run: the user chose the level by asking for each stage in turn.
- Provenance: human (conversation of 2026-10-24/25).

### W-02 — HIL 1, PRD approved — 2026-10-25

- Decision: `prd.md` approved ("PRD aprovado, pode seguir com a techspec"). Later touch-ups authorized by the user: no QA in the Portuguese variant (FR-19, FR-20), concurrency assumption per DEC-03, `mod-runtime.md` exception in Constraints.
- Provenance: human.

### W-03 — Storage exception to `mod-runtime.md` — 2026-10-25

- Decision: keep the feature files in the repository folder from `userConfig` (default `.claude/feature-progress/`) as a documented exception (TechSpec DEC-01).
- Provenance: human (question at the TechSpec stage, option "Exceção documentada").

### W-04 — HIL 2, TechSpec and plan approved — 2026-10-25

- Decision: `techspec.md` approved ("Aprovado, continue") and `tasks.md` approved ("Aprovar e continuar, executar o sdd em modo auto"). Authorizes implementation and corrections within these contracts, including the commit on branch `feat/relatorio-progresso` in `D:\Projetos\agents-instructions` (T08). Push and PR in that repository are not authorized yet.
- QA: runs after the review cycle, because the TechSpec has essential manual acceptance (TC-22 … TC-25).
- Provenance: human.

### W-05 — Autonomous mode — 2026-10-25

- Decision: `mode: auto` from the HIL 2 answer; decision log `autonomous-decisions.md`. Autonomous decisions follow `.agents/skills/sdd-orchestrate-flow/references/autonomous-mode.md` and are recorded here with their `AUTO-NN` ID.
- Provenance: human.

### W-06 — Autonomous decisions AUTO-01 … AUTO-03 — 2026-10-25

- AUTO-01: ContextBrake configured for automatic restarts; no warning.
- AUTO-02: T01 … T08 run without questions; T08.5 (push and PR) and T09 (manual acceptance in a real session) escalate.
- AUTO-03: T07 changes only this repository's `.agents/skills` copy, which `.gitignore` excludes; the copies in ContextBrake, Herdr and TokenHound stay as they are.
- Provenance: autonomous (`autonomous-decisions.md`).

### W-07 — Escalation AUTO-04 — 2026-10-25

- Gate: Exception. T08.5 is an external action (push and PR to `ColibriAgile/agents-instructions`, not authorized in W-04), and T09 is essential manual validation that needs the user in a real session; no other unit is eligible, and the review waits for every task (`delegated-review.md`, step 1).
- Provenance: autonomous (`autonomous-decisions.md#AUTO-04`); the answer is recorded below when it arrives.

### W-08 — Answer to the escalation W-07 — 2026-10-25

- Decision: push `feat/relatorio-progresso` and open its PR now; the user runs T09 alone, from a script this session prepares, and reports the result; keep the plan order (T09 before the delegated review and QA).
- Provenance: human (answers "Sim, push e PR agora", "Você testa sozinho", "T09 primeiro").

### W-09 — New scope: option to hide the band — 2026-10-25

- Decision: add an option to hide the band to this feature (new FR-22, DEC-13, task T10), not to a later feature. Form: a `userConfig` boolean `showBand` (default `true`) plus `/feature-progress band`, which flips it through `$.config.set`, so the value persists and survives `/clear`. T09 stays open while the user runs its script; T10 adds TC-26 to that script. Approval of the PRD, TechSpec and plan changes for this scope comes from this decision; the review still waits for T09 and T10.
- Provenance: human (request "adicionar ao feature-progress uma opção para esconder a banda"; answers "Na feature 02", "Config + comando", T09 "Estou rodando aqui pra testar").

### W-10 — T09 result and new scope: modern drawing — 2026-10-25

- Decision: the user ran T09 with a large feature in another repository and reports it OK; that closes TC-22 … TC-25 and TC-27. New scope in this feature (FR-23, DEC-14, task T11): a `paneBackground` option as in session-info, an `icons` option, and a more modern look with better colors and icons. Colors stay theme keys (`pane-ui.md`); the one hex value is `paneBackground`. T09.6 (screenshots, tested version) waits for T11, then the delegated review covers T01 … T11.
- Provenance: human ("Validei com uma feature grande em outro repo e está OK. Agora gostaria de melhorar a parte visual...").

### W-11 — Autonomous decision AUTO-06 — 2026-10-25

- Decision: T09 closes with T09.6's screenshots and the visual check of the T11 drawing as a pending manual acceptance item; the delegated review of T01 … T11 starts from base `e58daa9`. HIL 3 cannot be automatic while the visual check is pending.
- Provenance: autonomous (`autonomous-decisions.md#AUTO-06`).

### W-12 — Correction round 1 for codereview_01 — 2026-10-25

- Decision: review `codereview_01` is `REJECTED` (CR-01 High; CR-02 … CR-07 Low). Correction tasks T12 … T18 in `codereview_01/` (AUTO-07). T13 … T18 are done; T12.1 reopened T09. The TechSpec `$.state` contract now follows the code (AUTO-08, CR-06; new sha256 `9018b68d…`). T12.2 escalates to the user (AUTO-09); the re-review is delegated after T12.
- Provenance: autonomous (`autonomous-decisions.md#AUTO-07`, `#AUTO-08`, `#AUTO-09`).

### W-13 — Answer to the escalation AUTO-09 — 2026-10-25

- Decision: the user runs the real-session check of 0.3.0 (T12.2) and sends the 2 screenshots; this session then saves them, closes T12 and T09, and delegates the re-review.
- Provenance: human (answer "Eu testo e mando").

### W-14 — Real-session check of 0.3.0 received — 2026-10-25

- Decision: the user sent pane screenshots with `unicode`, `nerd` and `emoji` and reported `claude --debug`, `nerd` and `paneBackground` as OK. A wide `✖` in the `unicode` set became `✕`. T12 and T09 are complete; the re-review `codereview_02` is delegated with `codereview_01` as the previous review. No band screenshot was sent (open item in the T12 handoff).
- Provenance: human (screenshots and "Tudo ok").

### W-15 — Correction round 2 for codereview_02, and the root README image — 2026-10-25

- Decision: `codereview_02` is `REJECTED` (CR-01 Medium, CR-02 Low). T20 (CR-02) is done: README and TechSpec label rows follow `kindText` (TechSpec sha256 `8267f586…`). T19 (CR-01, band screenshot) escalates to the user (AUTO-10). On the user's request, the root `README.md` shows `feature-progress/images/pane-unicode.png` and 3 bullets after the session-info block (documentation only).
- Provenance: autonomous (`autonomous-decisions.md#AUTO-10`) and human ("Pode aproveitar as capturas para colocar no README.md", "ok, pode seguir").

### W-16 — Answer to the escalation AUTO-10 — 2026-10-25

- Decision: the user sends a cropped band screenshot of 0.3.0 for T19.
- Provenance: human (answer "Mando a captura").

### W-17 — T19 closed; re-review codereview_03 — 2026-10-25

- Decision: the band screenshot from the user is `feature-progress/images/band.png` in both READMEs; T19 and T20 are complete; the re-review `codereview_03` is delegated with `codereview_02` as the previous review, scoped like `codereview_02` (direct searches; previous findings and files changed since).
- Provenance: human (screenshot) and the user's earlier scope instruction for re-reviews.

### W-18 — codereview_03 APPROVED WITH RESERVATIONS — 2026-10-25

- Decision: documentation reservations corrected; the others accepted as open items (AUTO-11). The review cycle is closed; QA runs next (W-04: essential manual acceptance), delegated as `qa_01`.
- Provenance: autonomous (`autonomous-decisions.md#AUTO-11`).

### W-19 — QA qa_01 BLOCKED — 2026-10-25

- Decision: escalate (AUTO-12). No defect found; the block is the missing 0.3.0 real-session run of TC-22, TC-23, TC-24, TC-27 and one real `/feature-progress clean`.
- Provenance: autonomous (`autonomous-decisions.md#AUTO-12`); the answer is recorded below when it arrives.

### W-20 — Answer to the escalation AUTO-12 — 2026-10-25

- Decision: the user accepts the current evidence (0.2.0 real-session results, 0.3.0 screenshots and debug check, kit and unit tests, qa_01 headless runs). The qa_01 block (0.3.0 reruns of TC-22, TC-23, TC-24, TC-27 and a real `/feature-progress clean`) becomes an accepted open item; the flow goes to HIL 3.
- Provenance: human (answer "Aceitar a prova atual").

### W-21 — HIL 3: delivery accepted — 2026-10-25

- Decision: the user accepts feature-progress 0.3.0 with the open items listed at HIL 3 (W-20, AUTO-11) and asks for a commit through the `commit` skill. No ADR candidates.
- Provenance: human (answer "Aceitar e fazer commit").

## Recovery events

- None.
