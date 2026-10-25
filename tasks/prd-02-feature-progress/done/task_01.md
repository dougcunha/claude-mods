# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T01 — Scaffold the mod and the report model

## Outcome

The folder `feature-progress/` loads as a mod and passes `claude plugin validate feature-progress`. The helper `report.ts` turns an unknown tool input into a validated report, merges it into a stored feature, removes tasks and stamps the timestamps.

## Dependencies and boundaries

- Depends on: —
- Unblocks: T02
- In scope: manifest with the 3 `userConfig` keys, `hooks.json`, `tsconfig.json`, `types/index.d.ts`, `host.ts`, `paths.ts`, `report.ts`, a `register.tsx` that registers no hook yet, and their unit tests.
- Out of scope: the tool registration and storage (T02), any drawing (T03, T04), marketplace and README (T06).

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-02, FR-03, FR-04, FR-05, FR-06 | `prd.md#functional-requirements` | Merge, remove, fields, kinds, timestamps |
| DEC-04, DEC-07 | `techspec.md#technical-decisions` | Id rules; injected `now`, ISO timestamps, feature `updatedAt` moves with its tasks |
| CMP-01, CMP-02, CMP-03, CMP-06, CMP-07, CMP-13 | `techspec.md#components-and-flow` | Manifest, scaffold, report model, Host, paths, state types |
| TC-01 … TC-04 | `techspec.md#test-approach` | Report model tests |

## Context to recover on demand

- Applicable skills and rules: `ts-tests`; `.agents/rules/code-standards.md`, `javascript-typescript.md`, `mod-hooks.md` (Manifest), `tests.md`.
- Existing code: `session-info/.claude-plugin/plugin.json` (manifest shape), `session-info/hooks/host.ts` (Host boundary), `session-info/hooks/paths.ts` (`norm`, `absolute`), `session-info/tsconfig.json`.
- Contract or integration: `techspec.md#contracts-and-data` (tool input table, stored file, `userConfig`, `$.state`).
- Engine reference: `RegisteredToolSpec`; the engine types land in `feature-progress/.claude-plugin/types/` at the first load.

## Work

- [x] T01.1 Create `.claude-plugin/plugin.json` (version `0.1.0`, `types`, `userConfig` `folder`, `staleMinutes`, `editor` with titles, descriptions, defaults and `options`), `hooks/hooks.json`, `tsconfig.json`.
- [x] T01.2 Create `types/index.d.ts` with the `feature-progress` state keys (`features`, `warnings`, `isPaneOpen`) and the `Feature`, `Task`, `Kind` types.
- [x] T01.3 Create `hooks/host.ts` (members listed in CMP-06) and `hooks/paths.ts` (`norm`, `join`, `absolute`).
- [x] T01.4 Create `hooks/report.ts`: `KINDS`, `parseReport`, `applyReport` per the TechSpec input table and DEC-04, DEC-07.
- [x] T01.5 Create a minimal `hooks/register.tsx` that exports `register` and reads `options` once.
- [x] T01.6 Write `tests/report.test.ts` (TC-01 … TC-04) and `tests/paths.test.ts` (both separators, drive letter, spaces).

## Acceptance criteria

- A valid input returns a `Report`; each invalid case returns a message that names the field; an unknown kind lists the 9 kinds.
- A second report with only one task's `state` keeps that task's other fields and the task order.
- `remove` drops known ids and ignores unknown ids.
- `pending → active → done → fixing` sets `startedAt` once, sets then clears `finishedAt`, and moves the feature's `updatedAt`.
- No helper reads a clock or `$`.

## Verification

- Unit: `tests/report.test.ts`, `tests/paths.test.ts`.
- Kit: not applicable.
- Real session: not applicable.
- Manual: not applicable.
- Platforms: path helper cases with `\` and `/`, a drive letter, and spaces.
- Commands: `claude plugin validate .`, `claude plugin validate feature-progress`, `claude plugin test feature-progress`, `tsc -p feature-progress` (after the first load lays the types).
- Environment dependency: none.
- Expected evidence: validation passes; test count above zero and exit code 0; empty output from QA-01 … QA-07 on the diff.

## Affected files

- Create: `feature-progress/.claude-plugin/plugin.json`, `feature-progress/hooks/hooks.json`, `feature-progress/tsconfig.json`, `feature-progress/types/index.d.ts`, `feature-progress/hooks/host.ts`, `feature-progress/hooks/paths.ts`, `feature-progress/hooks/report.ts`, `feature-progress/hooks/register.tsx`, `feature-progress/tests/report.test.ts`, `feature-progress/tests/paths.test.ts`

## Observability and recovery

- Operational signal: none yet.
- Recovery: delete the new folder.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: `feature-progress/` loads and validates; `report.ts` parses the tool input (`parseReport`), merges a report into a stored feature with `remove` and timestamps (`applyReport`, `now` injected). `settings.ts` reads the 3 `userConfig` keys with manifest defaults (moved out of `register.tsx` per code-standards). `register.tsx` registers no hook yet.
- Changed files: created `feature-progress/.claude-plugin/plugin.json`, `hooks/hooks.json`, `tsconfig.json`, `types/index.d.ts`, `hooks/{host,paths,report,settings}.ts`, `hooks/register.tsx`, `tests/{report,paths,settings}.test.ts`.
- Checks: `claude plugin validate .` passed; `claude plugin validate feature-progress` passed (1 directory warning: no icon, not required by AGENTS.md); `claude plugin test feature-progress` 23 pass, 0 fail; `tsc -p feature-progress` exit 0. Quality profile: no blocking hit. Reservations: `tests/report.test.ts:18,26` `throw new Error` in test helpers (not a hook path); `hooks/report.ts:44,95` are false positives of QA-10 (the comma inside `Record<string, unknown>`; both functions take 3 parameters).
- Validated state: Windows 11, Claude Code 2.1.310, TypeScript 7.0.2; engine types copied from `session-info/.claude-plugin/types/` because `claude -p --plugin-dir` does not lay them (Git-ignored folder; the engine replaces it on a real load).
- Open items: none.

### ADR candidates

None - direct TechSpec implementation or local decision.
