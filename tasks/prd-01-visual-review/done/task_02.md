# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/prd.md`
2. `tasks/prd-01-visual-review/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T02 — Analysis round trip

## Outcome

On success, `/visual-review` saves `pendingRun`, shows a status, and sends the analysis prompt. The subagent calls `mcp__visual-review__submit_model`. A model with gaps gets a result that names each gap; a valid model gets "accepted" and clears the run and the status. An analysis turn that ends with no accepted model, or a dropped prompt, clears the status and shows a toast with the cause.

## Dependencies and boundaries

- Depends on: T01
- Unblocks: T03
- In scope: tool registration and `tool.call`, schema and narrowing, coverage, id and range checks, analysis prompt and tool description, `pendingRun` state, `turn.start` / `turn.complete`, `drop` handling, status.
- Out of scope: Git hunks, metrics and the view model (T03); writing files; the server.

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-05, FR-06, FR-14, FR-25 | `prd.md#functional-requirements` | Subagent analysis, coverage retry, table sources in the prompt, progress and failure |
| NFR-10 | `prd.md#non-functional-requirements` | 1 analysis per run |
| DEC-01, DEC-08, DEC-11 | `techspec.md#technical-decisions` | Subagent + tool, range check, failure by `turnId` |
| CMP-04, CMP-08 | `techspec.md#components-and-flow` | `model.ts`, analysis part of `prompts.ts` |
| TC-05, TC-06, TC-13, TC-15 | `techspec.md#test-approach` | Coverage, tool cases, prompt text, failure |

## Context to recover on demand

- Applicable skills and rules: `.agents/rules/mod-hooks.md` (critical areas: gating hooks, agent-facing text, registered tools), `tests.md` ("Agent-facing text", "State").
- Existing code: `session-info/hooks/todos.ts:19` (`ToolSpec` with `inputSchema`), `session-info/hooks/register.tsx:1225-1234` (`tool.call` answer shape, `e.agentId`).
- Contract or integration: `techspec.md#contracts-and-data` (Tool `submit_model`, `$.state`, Text the mod adds), `techspec.md#errors-security-and-recovery`.
- Engine reference: `$.tool.register`, `ToolSpec.isDeferred`, `tool.call`, `$.prompt.submit`, `PromptSubmitResult.drop`, `TurnStartInput`, `TurnCompleteInput`, `$.ui.status`, `$.state`.

## Work

- [x] T02.1 Create `hooks/model.ts`: `SUBMIT_SCHEMA`, `SOURCE_EXTENSIONS`, narrowing from `unknown`, coverage (`units`, `tables.source`, `skippedFiles`), unknown ids in relations and entities, range name check in the first `RANGE_NAME_LINES` lines.
- [x] T02.2 Create the analysis prompt and the tool description in `hooks/prompts.ts`, with the subagent model from `analysisModel`.
- [x] T02.3 Declare `pendingRun` in `types/index.d.ts`; extend `Host` with `readFile`, `submit`, `status`, `toast`.
- [x] T02.4 In `register.tsx`: register the tool (deferred); `command.run` saves the run and submits; `tool.call` with `.catch`; `turn.start` / `turn.complete` observers.
- [x] T02.5 Write `tests/model.test.ts` (TC-05), `tests/prompts.test.ts` (TC-13 analysis part), kit tests TC-06 and TC-15.
- [x] T02.6 Real session check: the subagent finds the deferred tool; `--debug-file` shows `tool.call`, `turn.start`, `turn.complete` reach the mod.

## Acceptance criteria

- A model that omits a changed `.cs`, `.ts` or `.py` file gets a result that names the file.
- An old `runId` gets the "replaced" result; a call with no pending run says to run `/visual-review`.
- The analysis prompt text changes only when `analysisModel` changes.
- A `turn.complete` of another turn changes nothing.

## Verification

- Unit: TC-05, TC-13 (analysis prompt and tool description, exact text).
- Kit: TC-06, TC-15 on `terminal` and `desktop`.
- Real session: in this repository, make a small change, run `/visual-review`, and see the subagent call the tool and get "accepted". Record whether the subagent needed ToolSearch.
- Manual: not applicable.
- Platforms: Windows.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Environment dependency: a real session with a plan or API key (existing).
- Expected evidence: test count and exit code 0; the tool call in the transcript; `--debug-file` lines for the hooks.

## Affected files

- Modify: `visual-review/hooks/register.tsx`, `visual-review/hooks/host.ts`, `visual-review/types/index.d.ts`, `visual-review/tests/visual-review.test.ts`
- Create: `visual-review/hooks/model.ts`, `visual-review/hooks/prompts.ts`, `visual-review/tests/model.test.ts`, `visual-review/tests/prompts.test.ts`

## Observability and recovery

- Operational signal: `$.ui.status` while the run waits; toast on failure (no model text in it).
- Recovery: a new `/visual-review` replaces a stuck run; `/clear` resets `pendingRun`.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: `/visual-review` saves `pendingRun`, shows the status `Analyzing the design of the change…`, answers `Analyzing the design of <n> changed files against <base>.`, and submits the analysis prompt. The deferred tool `mcp__visual-review__submit_model` narrows its input, checks coverage, ids and ranges, returns the gaps, or accepts the model and clears the run and the status. The analysis turn (found by the run id in the `turn.start` text of the main loop) that ends with no accepted model, and a dropped prompt, clear the status and toast the cause. `session.end` clears the status.
- Changed files: created `visual-review/hooks/model.ts`, `hooks/prompts.ts`, `tests/model.test.ts`, `tests/prompts.test.ts`; modified `hooks/register.tsx`, `hooks/host.ts` (`readFile`), `hooks/git.ts` (success text), `tests/visual-review.test.ts`, `README.md`. `types/index.d.ts` already declared `pendingRun` in T01 (AUTO-06).
- Checks:
  - `claude plugin validate visual-review`: passed; `command.run` and `tool.call` are gating hooks with `.catch`; `turn.start`, `turn.complete`, `session.start`, `session.end` are observers with `.catch(next)`.
  - `claude plugin test visual-review`: 37 pass, 0 fail, exit 0 (4 files).
  - `tsc -p visual-review`: exit 0.
  - Manual mutant pass: coverage check inverted (`!covered.has` to `covered.has`) failed TC-05 and TC-06; the range name window shortened by 1 line failed the line-5 range case; the turn match inverted (`===` to `!==`) failed TC-15. All reverted (`grep` shows none left), suite green again.
  - Real session (stream-json headless in a sample TypeScript repository with 1 new class, `--plugin-dir visual-review`): the command answered `Analyzing the design of 1 changed file against main.`; the main loop started 1 Agent with `model: sonnet`; the subagent called ToolSearch with `select:mcp__visual-review__submit_model` (so it needed ToolSearch), then `submit_model` once; the tool accepted the model on the first call; the debug log shows `tool.call ... resolved by a hooks module (result)`, `$.ui.status (visual-review): (cleared)`, and `turn.start` and `turn.complete` settled through the mod (not skipped by the organization policy).
  - Quality profile: QA-01 to QA-06 no hit. QA-07: 4 reservation hits, all in tests (`tests/visual-review.test.ts:43`, `:48`, `tests/model.test.ts:116` are throws inside fakes; `tests/visual-review.test.ts:107` is a `for` destructuring that the 4-parameter pattern matches). The 4-parameter hit in `hooks/model.ts` (`rangeGap`) was fixed: it now takes a `RangeCheck` object.
- Validated state: base `8d5ddeb` plus the T01 and T02 diff; Windows 11, Claude Code 2.1.308, Git for Windows, kit tests on `terminal` and `desktop`.
- Open items:
  - The engine refuses `$.prompt.submit` from a `command.run` hook (`it would wait on the turn this hook is holding; submit from a later event`). The command submits the prompt from `$.clock.after(0)` once the hook answered. AUTO-07.
  - `Host` gets only `readFile`: no helper calls `submit`, `status` or `toast`, which `register.tsx` calls on `$` (`code-standards.md`: a new engine call a helper needs becomes a Host member). AUTO-08.
  - A `module` unit skips the name check of DEC-08: a module is named after its file, so its first lines need not hold the name. AUTO-08.
  - `checkRanges` returns the ids of units whose file could not be read (`unchecked`); T03 shows them as "range not checked".
  - A command answer shows under the mod's name, so the `.catch` text reads `visual-review: visual-review: ...` in the transcript (see T01).

### ADR candidates

None - direct TechSpec implementation or local decision.
