# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T02 — Store reports through the tool

## Outcome

A call to `mcp__feature-progress__report` from the main session validates the input, reads the stored feature file, merges, writes `<folder>/<id>.json`, updates `$.state`, and replies `feature-progress: <stage> · <n>/<m>`. The mod loads the folder at `session.start` and again after a `/clear` or `/resume` switch. A subagent call is ignored; invalid input and unreadable files are refused.

## Dependencies and boundaries

- Depends on: T01
- Unblocks: T03, T07
- In scope: `store.ts` (folder, file name, parse, serialize with the 4 MiB guard, load all, read one, write one), `spec.ts` (`REPORT_SPEC` with the exact description), `progress.ts` (`stageText`, `countOf`, `replyText` only), hooks `session.start` (register the tool, load), `session.end` (DEC-09), `tool.call` on `REPORT_TOOL`.
- Out of scope: drawing, the command, the timer (T03, T04), `cleanArgv` and the clean command (T05).

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-01, FR-02, FR-07, FR-08, FR-13, FR-16, FR-18 | `prd.md#functional-requirements` | Tool, merge on disk, storage folder, reply, count, load points, unreadable file |
| NFR-02, NFR-03 | `prd.md#non-functional-requirements` | No polling; 4 MiB guard |
| DEC-01, DEC-02, DEC-03, DEC-09 | `techspec.md#technical-decisions` | Storage scope, reply shape, read-merge-write, reload after switch |
| CMP-04 (part), CMP-05, CMP-09, CMP-12 | `techspec.md#components-and-flow` | Report flow and load flow |
| TC-05, TC-06 (reply), TC-09, TC-10, TC-12, TC-13 | `techspec.md#test-approach` | Tool, storage and load tests |

## Context to recover on demand

- Applicable skills and rules: `ts-tests`; `.agents/rules/mod-hooks.md` (critical areas: registered tool, failure model), `mod-runtime.md` (Files), `tests.md`.
- Existing code: `session-info/hooks/todos.ts:19` (`TODO_SPEC`), `session-info/hooks/register.tsx:1019-1027` (registrations), `:1159-1196` and `:500` (`afterSwitch` reload), `:1253-1262` (tool answered by its own hook).
- Contract or integration: `techspec.md#contracts-and-data` (tool description text, stored file), `techspec.md#integrations-and-interfaces`.
- Engine reference: `$.tool.register`, `ToolCallResult` (`deny`), `$.fs.read/write/list`, `$.clock.now`, `session.end` reasons, `$.session.id`.

## Work

- [x] T02.1 Create `hooks/store.ts` with `folderOf`, `fileName`, `parseFeature`, `serialize` (4 MiB guard), `loadAll`, `readOne`, `writeOne` through the `Host`.
- [x] T02.2 Create `hooks/spec.ts` with `REPORT_NAME`, `REPORT_TOOL`, `REPORT_SPEC` (exact description from the TechSpec).
- [x] T02.3 Create `hooks/progress.ts` with `stageText`, `countOf`, `replyText`.
- [x] T02.4 In `register.tsx`: build the `Host` from `$`; `session.start` registers the tool and loads the folder; `session.end` reloads after the id switch; `tool.call` on `REPORT_TOOL` runs the report flow with its `.catch` answer.
- [x] T02.5 Write `tests/store.test.ts` (TC-09, TC-10), `tests/progress.test.ts` (reply and count part of TC-06), `tests/register.test.ts` (TC-05, TC-12, TC-13).

## Acceptance criteria

- The registered spec equals `REPORT_SPEC`, with the exact description text.
- A valid call writes one file in the configured folder and answers `{ result }` with stage and `n/m`.
- An invalid call answers `{ deny }` that names the field; nothing is written.
- A call with `e.agentId` set answers `Ignored: only the main session reports progress.` and writes nothing.
- A report merges with the version on disk, not only with `$.state`.
- A report for an unreadable file answers `{ deny }`; the file is untouched.
- A report whose file would pass 4 MiB answers `{ deny }`; nothing is written.
- Between `session.start` and a report, no file is read.

## Verification

- Unit: `tests/store.test.ts`, `tests/progress.test.ts` with a fake `Host` that records `writeFile` calls.
- Kit: `tests/register.test.ts` raises `session.start` and `tool.call` through `claude-code/testing`.
- Real session: covered by T09 (TC-23 for `/clear` and `/resume`, which the kit does not reproduce).
- Manual: not applicable.
- Platforms: folder resolution with both separators and a drive letter.
- Commands: `claude plugin validate .`, `claude plugin validate feature-progress`, `claude plugin test feature-progress`, `tsc -p feature-progress`.
- Environment dependency: none.
- Expected evidence: tests pass with exit code 0; `claude plugin validate feature-progress` lists `tool.call` with `.catch`.

## Affected files

- Create: `feature-progress/hooks/store.ts`, `feature-progress/hooks/spec.ts`, `feature-progress/hooks/progress.ts`, `feature-progress/tests/store.test.ts`, `feature-progress/tests/progress.test.ts`, `feature-progress/tests/register.test.ts`
- Modify: `feature-progress/hooks/register.tsx`

## Observability and recovery

- Operational signal: the tool's `result` or `deny` text; a toast when a registration fails.
- Recovery: revert the task's commit; stored files are plain JSON the person can delete.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: `mcp__feature-progress__report` is registered at `session.start` with `REPORT_SPEC`; its own `tool.call` hook validates, reads the file on disk, merges, writes `<folder>/<id>.json` (4 MiB guard), updates `$.state` and answers `feature-progress: <stage> · <n>/<m>`. Invalid input, an unreadable file and a write failure answer `{ deny }`; a subagent call answers `Ignored: …`. The folder loads at `session.start` and after the session id switches on `/clear` or `/resume`.
- Changed files: created `feature-progress/hooks/{store,progress,spec}.ts`, `feature-progress/tests/{store,progress,register}.test.ts`; modified `feature-progress/hooks/register.tsx`.
- Checks: `claude plugin validate feature-progress` passed (lists `tool.call` with `.catch`); `claude plugin test feature-progress` 43 pass, 0 fail; `tsc -p feature-progress` exit 0. Quality profile: no blocking hit. Reservations: `throw new Error` in test fakes that simulate a missing file or a write failure (`tests/store.test.ts:27`, `tests/register.test.ts:33,41`), and QA-10 false positives on 3-parameter functions whose type has a comma (`hooks/report.ts:44,95`, `tests/register.test.ts:25`).
- Validated state: Windows 11, Claude Code 2.1.310, TypeScript 7.0.2. The kit hands fs hooks absolute Windows paths (`D:epo\…`); the test fake normalizes them. The kit test covers the `/clear` reload (DEC-09) with a switching `session.id`; the real-session check stays in T09 (TC-23).
- Open items: `.claude-plugin/types/claude-code-mcp/index.d.ts` was written by hand in the Git-ignored types folder so `tsc` knows the tool's input; a real load regenerates it (T09).

### ADR candidates

None - direct TechSpec implementation or local decision.
