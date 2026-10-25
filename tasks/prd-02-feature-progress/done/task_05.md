# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T05 — Open task links and clean done features

## Outcome

A task with `link` shows a control in the pane that opens the file with the `editor` option (`auto`, `vscode`, `system`); a missing file shows a toast with its path. `/feature-progress clean` deletes the files of every `done` feature through `$.process.run` in the storage folder, reloads, and toasts `Deleted N done features`.

## Dependencies and boundaries

- Depends on: T04
- Unblocks: T06
- In scope: `viewer.ts` (copy of the `editor` part of session-info, DEC-08), `cleanArgv` in `store.ts` (DEC-05), the link control in `pane.tsx`, the `clean` branch of the command.
- Out of scope: any other delete; files outside the storage folder.

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-15, FR-17 | `prd.md#functional-requirements` | Link control; clean command |
| NFR-07 | `prd.md#non-functional-requirements` | Windows, macOS, Linux argv |
| DEC-05, DEC-08 | `techspec.md#technical-decisions` | Delete argv with the folder as `cwd`; copied `editor` logic |
| CMP-05 (clean), CMP-08 | `techspec.md#components-and-flow` | Clean argv, viewer |
| TC-11, TC-18, TC-19 | `techspec.md#test-approach` | Clean and link tests |
| QA-04 | `techspec.md#quality-profile` | `cmd /c` hit justified by DEC-05 |

## Context to recover on demand

- Applicable skills and rules: `ts-tests`; `.agents/rules/mod-runtime.md` (Processes, Platforms), `tests.md` (fake `Host` records argv).
- Existing code: `session-info/hooks/viewer.ts` (`splitCommand`, `platformOf`, `succeeds`, launch argv for `vscode` and `system`).
- Contract or integration: `techspec.md#integrations-and-interfaces` (`$.process.run` row), `techspec.md#errors-security-and-recovery`.
- Engine reference: `$.process.run(argv, { cwd })`, `$.env`.

## Work

- [x] T05.1 Create `hooks/viewer.ts` with `openLink` for `auto`, `vscode`, `system`, and a missing-file toast.
- [x] T05.2 Add `cleanArgv(platform, names)` to `hooks/store.ts` per DEC-05.
- [x] T05.3 Add the link control to `pane.tsx` and the `clean` branch to the command in `register.tsx` (only ids whose state is `done`).
- [x] T05.4 Write `tests/viewer.test.ts` (TC-18), extend `tests/store.test.ts` (TC-11) and `tests/register.test.ts` (TC-19).

## Acceptance criteria

- `cleanArgv` gives `['rm', '-f', '--', …names]` on macOS and Linux and `['cmd', '/d', '/c', 'del', '/f', '/q', …names]` on Windows; the folder appears only as `cwd`, also with spaces.
- With 2 done and 1 active feature, clean runs one command with the 2 file names and toasts `Deleted 2 done features`; the active file stays.
- A failing delete toasts the failure; the reload shows the files that are left.
- `editor: system` and `editor: vscode` produce the expected argv per platform; `auto` uses VS Code only when its command exists.
- A link to a missing file toasts `feature-progress: …` with the path.

## Verification

- Unit: `tests/viewer.test.ts`, `tests/store.test.ts` with a fake `Host` that records `run` argv and `cwd`.
- Kit: `tests/register.test.ts` for the `clean` command and the link press, on both surfaces.
- Real session: link and clean on Windows in T09.
- Manual: not applicable.
- Platforms: Windows real; macOS and Linux by argv unit tests only (TechSpec gap).
- Commands: `claude plugin validate feature-progress`, `claude plugin test feature-progress`, `tsc -p feature-progress`.
- Environment dependency: none.
- Expected evidence: tests pass; QA-04 hits only at the DEC-05 and DEC-08 spots.

## Affected files

- Create: `feature-progress/hooks/viewer.ts`, `feature-progress/tests/viewer.test.ts`
- Modify: `feature-progress/hooks/store.ts`, `feature-progress/hooks/pane.tsx`, `feature-progress/hooks/register.tsx`, `feature-progress/tests/store.test.ts`, `feature-progress/tests/register.test.ts`

## Observability and recovery

- Operational signal: toasts for clean and link results.
- Recovery: revert the task's commit; a deleted file is gone, but its feature was `done`.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: a task with `link` shows an `open` button; `openLink` resolves the link from the working directory, toasts a missing file, picks VS Code or the system's default program from `editor` (`auto` looks for `code`), and refuses a Windows path with `cmd` syntax (`&|<>^%!"`) before `cmd /c code`, since the link comes from the model. `/feature-progress clean` reads the folder, runs `cleanArgv` with the storage folder as `cwd` and only `<id>.json` names, reads the folder again, and answers and toasts `Deleted N done features.` or `Deleted X of N done features; the others are still in <folder>.`.
- Changed files: created `feature-progress/hooks/{platform,viewer}.ts`, `feature-progress/tests/viewer.test.ts`; modified `feature-progress/hooks/{store.ts,pane.tsx,register.tsx}`, `feature-progress/tests/{store,pane}.test.ts`.
- Checks: `claude plugin test feature-progress` 71 pass, 0 fail; `claude plugin validate feature-progress` passed; `tsc -p feature-progress` exit 0. Quality profile: QA-04 hits at `hooks/store.ts:146` (DEC-05) and `hooks/viewer.ts:12,19` (DEC-08, the session-info launcher shape) are covered by prior justifications; no other blocking hit. Reservations: QA-10 false positive at `hooks/viewer.ts:18` (3 parameters with a generic type) plus the earlier ones.
- Validated state: Windows 11, Claude Code 2.1.310. The Host has no `spawn`, so a link opens through `$.process.run`; `explorer.exe` exits with 1 even on success, so only a program that did not start is reported. macOS and Linux argv are covered by unit tests only.
- Open items: none.

### ADR candidates

None - direct TechSpec implementation or local decision.
