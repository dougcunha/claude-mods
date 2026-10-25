# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T08 — Report progress from the Portuguese SDD skills

## Outcome

In `D:\Projetos\agents-instructions`, on branch `feat/relatorio-progresso` from `master`, `SKILLS/sdd-orquestrar-tasks/references/relatorio-progresso.md` defines the same protocol in Portuguese, with the Portuguese phase and status names and no `qa` row. Each Portuguese skill links to it at its transition lines. The change is committed on the branch; push and PR wait for the user's go-ahead.

## Dependencies and boundaries

- Depends on: T07
- Unblocks: —
- In scope: the new reference file in Portuguese, one short link at each transition line, a commit on the branch with a Portuguese subject.
- Out of scope: a QA stage for this variant; `Update-AllSkills.ps1`; push and PR without the user's go-ahead.

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-19, FR-20, OBJ-04 | `prd.md#functional-requirements` | Portuguese skills call the tool; no `qa` |
| NFR-08 | `prd.md#non-functional-requirements` | Safe without the mod |
| DEC-11, DEC-12 | `techspec.md#technical-decisions` | One protocol file; no QA in Portuguese |
| CMP-19 | `techspec.md#components-and-flow` | Portuguese files |
| TC-21 | `techspec.md#test-approach` | Review and `rg` |

## Context to recover on demand

- Applicable skills and rules: the repository's own conventions (Portuguese skill text and commit subjects; PRs from `feat/<topic>` branches); `.agents/skills/sdd-orchestrate-tasks/references/progress-report.md` from T07 as the model, rewritten for this variant, not copied.
- Existing code (transition lines in `SKILLS/`): `sdd-orquestrar-fluxo/SKILL.md` steps 2-6 (lines 18-37); `sdd-orquestrar-fluxo/references/estado-hil.md:35` (pausado/ativo), `:65` (concluido); `sdd-revisar-codigo/references/revisao-delegada.md:20` (revisão começa), `:53` (revisão termina); `sdd-orquestrar-tasks/SKILL.md:16, 18, 26, 28`; `sdd-executar-task/SKILL.md:13, 26`; `sdd-planejar-tasks/SKILL.md:18`; `sdd-planejar-correcoes/SKILL.md:17`; `sdd-executar-correcoes/SKILL.md:17, 22, 24`.
- Contract or integration: `techspec.md#contracts-and-data` (SDD state mapping, Portuguese column).
- Engine reference: not applicable.

## Work

- [x] T08.1 Create branch `feat/relatorio-progresso` from an up-to-date `master` in `D:\Projetos\agents-instructions`.
- [x] T08.2 Write `SKILLS/sdd-orquestrar-tasks/references/relatorio-progresso.md` in Portuguese with the Portuguese mapping and no `qa` row.
- [x] T08.3 Add one short link sentence at each transition line listed above.
- [x] T08.4 Run `rg -n "relatorio-progresso.md" SKILLS` and commit with a Portuguese subject.
- [x] T08.5 Ask the user before push and PR.

## Acceptance criteria

- Every transition listed has a link to the protocol; the protocol skips the step without the tool.
- The mapping uses `produto`, `projeto-plano`, `implementacao`, `revisao`, `correcoes`, `aceite`, `concluido`, `aguardando-hil`, `bloqueado`, and has no `qa` row.
- The commit is on `feat/relatorio-progresso`, not on `master`.

## Verification

- Unit: not applicable.
- Kit: not applicable.
- Real session: not required; T09 runs the English variant.
- Manual: review of each changed line against the TechSpec mapping.
- Platforms: not applicable.
- Commands: `rg -n "relatorio-progresso.md" SKILLS`, `git -C D:/Projetos/agents-instructions status`, `git -C D:/Projetos/agents-instructions log -1`.
- Environment dependency: write access to `D:\Projetos\agents-instructions`; push and PR need the user's go-ahead.
- Expected evidence: `rg` output; the commit hash on the branch.

## Affected files

- Create: `D:\Projetos\agents-instructions\SKILLS\sdd-orquestrar-tasks\references\relatorio-progresso.md`
- Modify: `SKILLS/sdd-orquestrar-fluxo/SKILL.md`, `SKILLS/sdd-orquestrar-fluxo/references/estado-hil.md`, `SKILLS/sdd-planejar-tasks/SKILL.md`, `SKILLS/sdd-orquestrar-tasks/SKILL.md`, `SKILLS/sdd-executar-task/SKILL.md`, `SKILLS/sdd-planejar-correcoes/SKILL.md`, `SKILLS/sdd-executar-correcoes/SKILL.md`, `SKILLS/sdd-revisar-codigo/references/revisao-delegada.md`

## Observability and recovery

- Operational signal: not applicable.
- Recovery: delete the branch, or revert its commit.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: on branch `feat/relatorio-progresso` of `D:/Projetos/agents-instructions` (from an up-to-date `master`), `SKILLS/sdd-orquestrar-tasks/references/relatorio-progresso.md` defines the protocol in Portuguese, with the Portuguese phase and status names, no `qa` row (the variant has no QA stage), and the repository's reference style ("`references/X.md` da skill `Y`"). 15 transition lines in 8 files end with one sentence that reports the change under the protocol. Commit `8bad3bd` (`SDD: relatório de progresso para o mod feature-progress`).
- Changed files: created `SKILLS/sdd-orquestrar-tasks/references/relatorio-progresso.md`; modified `SKILLS/sdd-orquestrar-fluxo/SKILL.md`, `SKILLS/sdd-orquestrar-fluxo/references/estado-hil.md`, `SKILLS/sdd-planejar-tasks/SKILL.md`, `SKILLS/sdd-orquestrar-tasks/SKILL.md`, `SKILLS/sdd-executar-task/SKILL.md`, `SKILLS/sdd-planejar-correcoes/SKILL.md`, `SKILLS/sdd-executar-correcoes/SKILL.md`, `SKILLS/sdd-revisar-codigo/references/revisao-delegada.md`.
- Checks: `rg -n "relatorio-progresso.md|mesmo protocolo" SKILLS` lists the 15 transitions; `git diff --stat` before the commit showed 15 insertions and 15 deletions (one sentence per line, LF kept); `git status` clean after the commit.
- Validated state: branch `feat/relatorio-progresso` at `8bad3bd`, pushed after the user's go-ahead (W-08); PR https://github.com/ColibriAgile/agents-instructions/pull/18 to `master`.
- Open items: projects get the change only after the PR merges and `Update-AllSkills.ps1` runs.

### ADR candidates

None - direct TechSpec implementation or local decision.
