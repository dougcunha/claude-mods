# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T07 — Report progress from the English SDD skills

## Outcome

`.agents/skills/sdd-orchestrate-tasks/references/progress-report.md` defines the report protocol once: when the host has `mcp__feature-progress__report`, the orchestrating session reports each state change; without the tool, the step is skipped with no question and no error. Each English skill links to it at its transition lines, with the state mapping from the TechSpec.

## Dependencies and boundaries

- Depends on: T02 (stable tool contract)
- Unblocks: T08, T09
- In scope: the new reference file and one short link at each transition line listed below.
- Out of scope: the Portuguese variant (T08); any change to stage logic, checkpoint fields or artifact names; reports from delegated reviewer or QA subagents.

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-19, FR-20, OBJ-04 | `prd.md#functional-requirements` | Skills call the tool with the mapping |
| NFR-08 | `prd.md#non-functional-requirements` | Safe without the mod |
| DEC-11 | `techspec.md#technical-decisions` | One protocol file per variant |
| CMP-18 | `techspec.md#components-and-flow` | English files |
| TC-20 | `techspec.md#test-approach` | Review and `rg` |

## Context to recover on demand

- Applicable skills and rules: `AGENTS.md` (English text).
- Existing code (transition lines at `e58daa9`): `sdd-orchestrate-flow/SKILL.md` steps 2-6 (lines 18-37); `sdd-orchestrate-flow/references/hil-state.md:36` (paused/active), `:66` (completed); `sdd-review-code/references/delegated-review.md:20` (review starts), `:50-53` (review ends), `:64-65` (QA); `sdd-orchestrate-tasks/SKILL.md:16` (reopen), `:18` (select), `:26` (block), `:28` (done); `sdd-execute-task/SKILL.md:13` (subtask checkboxes), `:26` (block); `sdd-plan-tasks/SKILL.md:18` (initial plan); `sdd-plan-corrections/SKILL.md:17` (correction tasks); `sdd-execute-corrections/SKILL.md:17` (select), `:22` (block), `:24` (done).
- Contract or integration: `techspec.md#contracts-and-data` (SDD state mapping, tool input), `sdd-orchestrate-tasks/references/session-continuity.md:30` (phrasing for an optional host tool).
- Engine reference: not applicable.

## Work

- [x] T07.1 Write `references/progress-report.md`: availability rule, who calls (the orchestrating session only), the mapping table for the English variant, `round` sources (`codereview_NN`, `qa_NN`), correction `group` and `link`, the feature `id` (slug) and title (PRD heading), 2 example payloads.
- [x] T07.2 Add one short link sentence at each transition line listed above.
- [x] T07.3 Run `rg -n "progress-report.md" .agents/skills` and check each listed transition has a link.

## Acceptance criteria

- Every transition listed in the context section has a link to the protocol.
- The protocol says to skip the step, with no question, when the tool is absent.
- The mapping matches the TechSpec table for the English variant, including `qa` with its round.
- No skill line changes meaning beyond the added report step.

## Verification

- Unit: not applicable.
- Kit: not applicable.
- Real session: T09 (TC-22, TC-25).
- Manual: review of each changed line against the TechSpec mapping.
- Platforms: not applicable.
- Commands: `rg -n "progress-report.md" .agents/skills`.
- Environment dependency: none.
- Expected evidence: `rg` output lists every transition file.

## Affected files

- Create: `.agents/skills/sdd-orchestrate-tasks/references/progress-report.md`
- Modify: `.agents/skills/sdd-orchestrate-flow/SKILL.md`, `.agents/skills/sdd-orchestrate-flow/references/hil-state.md`, `.agents/skills/sdd-plan-tasks/SKILL.md`, `.agents/skills/sdd-orchestrate-tasks/SKILL.md`, `.agents/skills/sdd-execute-task/SKILL.md`, `.agents/skills/sdd-plan-corrections/SKILL.md`, `.agents/skills/sdd-execute-corrections/SKILL.md`, `.agents/skills/sdd-review-code/references/delegated-review.md`

## Observability and recovery

- Operational signal: the band and pane during a flow run.
- Recovery: revert the task's commit; the skills work as before.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: `sdd-orchestrate-tasks/references/progress-report.md` defines the protocol once: availability (`mcp__feature-progress__report` in Claude Code; without it, skip with no question, record or retry), the owner (the session that writes the artifacts; delegated reviewers, QA runners and explorers never report), identity (`feature.id` = slug, title from the PRD heading, task `link` from the repository root), a table of 10 events with their skill and step, the checkpoint-to-state mapping (`paused` not reported), and 2 example payloads. 18 transition lines in 8 skill files end with one sentence that reports the change under the protocol.
- Changed files: created `.agents/skills/sdd-orchestrate-tasks/references/progress-report.md`; modified `.agents/skills/sdd-orchestrate-flow/SKILL.md`, `.agents/skills/sdd-orchestrate-flow/references/hil-state.md`, `.agents/skills/sdd-plan-tasks/SKILL.md`, `.agents/skills/sdd-orchestrate-tasks/SKILL.md`, `.agents/skills/sdd-execute-task/SKILL.md`, `.agents/skills/sdd-plan-corrections/SKILL.md`, `.agents/skills/sdd-execute-corrections/SKILL.md`, `.agents/skills/sdd-review-code/references/delegated-review.md`.
- Checks: `rg -n "progress-report.md|same protocol" .agents/skills` lists every transition named in this task (flow save, completion, review and QA reserve and receive, task select, subtask steps, block, done, reopen, plan written, corrections written). Each line kept its meaning; only one sentence was added at its end. Line endings stay LF.
- Validated state: local files only. `.agents/` is in the root `.gitignore`, so Git does not track these changes, and the copies of the same skills in `D:/MyProjects/ContextBrake`, `Herdr` and `TokenHound` do not get them (AUTO-03).
- Open items: the real effect of the report steps shows in T09 (TC-22, TC-25).

### ADR candidates

None - direct TechSpec implementation or local decision.
