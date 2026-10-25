# Implementation plan — feature-progress

## Stable sources

- PRD: `tasks/prd-02-feature-progress/prd.md`
- TechSpec: `tasks/prd-02-feature-progress/techspec.md`

> Common sources come before the task and mutable state; read order does not guarantee a cache hit.

## Dependency graph

| ID | Delivery | Depends on | Unblocks |
| --- | --- | --- | --- |
| T01 | The mod loads and validates; the report model parses, merges, removes and stamps a report | — | T02 |
| T02 | A call to `mcp__feature-progress__report` stores the feature file and replies; the mod reloads it at start, `/clear` and `/resume` | T01 | T03, T07 |
| T03 | The band shows the latest open feature with its stage, `n/m` and stale marker | T02 | T04 |
| T04 | `/feature-progress` and the band open the pane, which lists features, grouped tasks, warnings and Refresh | T03 | T05 |
| T05 | A task link opens its file, and `/feature-progress clean` deletes the files of done features | T04 | T06 |
| T06 | The mod is documented, registered in the marketplace, and the storage exception is in `mod-runtime.md` | T05 | T09 |
| T07 | The English SDD skills report progress through one shared protocol | T02 | T08, T09 |
| T08 | The Portuguese SDD skills report progress through one shared protocol, in their own repository | T07 | — |
| T09 | A real session confirms the flow, `/clear`, Refresh, the skills without the mod and the hidden band; the README states the tested version | T06, T07, T10, T11 | — |
| T10 | The `showBand` option and `/feature-progress band` hide and show the band, and the README documents them | T06 | T09, T11 |
| T11 | A modern drawing of the band and the pane, with the `paneBackground` and `icons` options | T10 | T09 |

## Traceability matrix

| Source ID | Source section | Obligation | Tasks | Evidence or test |
| --- | --- | --- | --- | --- |
| OBJ-01 | `prd.md#outcomes-and-metrics` | Stage and task states visible during a flow run | T03, T04, T07, T09 | TC-22 |
| OBJ-02 | `prd.md#outcomes-and-metrics` | Another flow integrates from the README alone | T06 | FR-21 review |
| OBJ-03 | `prd.md#outcomes-and-metrics` | Progress survives session boundaries | T02, T09 | TC-12, TC-13, TC-23 |
| OBJ-04 | `prd.md#outcomes-and-metrics` | Both skill variants report; no error without the mod | T07, T08, T09 | TC-20, TC-21, TC-25 |
| US-01 … US-03 | `prd.md#stories-and-journeys` | Stage, task state, steps, correction groups | T03, T04 | TC-14, TC-16 |
| US-04 | `prd.md#stories-and-journeys` | Other flows report from their skills | T06 | FR-21 review |
| US-05 | `prd.md#stories-and-journeys` | Last state after `/clear` or a new session | T02, T09 | TC-13, TC-23 |
| US-06 | `prd.md#stories-and-journeys` | Refresh shows another session's report | T04, T09 | TC-24 |
| US-07 | `prd.md#stories-and-journeys` | Stale marker | T03 | TC-07, TC-17 |
| US-08 | `prd.md#stories-and-journeys` | Clean done features | T05 | TC-19 |
| FR-01 | `prd.md#functional-requirements` | Tool registered with its contract | T02 | TC-05 |
| FR-02 | `prd.md#functional-requirements` | Partial merge by task id | T01, T02 | TC-02, TC-12 |
| FR-03 | `prd.md#functional-requirements` | `remove` | T01 | TC-03 |
| FR-04 | `prd.md#functional-requirements` | Fields and required titles | T01 | TC-01, TC-02 |
| FR-05 | `prd.md#functional-requirements` | 9 kinds, invalid refused | T01 | TC-01 |
| FR-06 | `prd.md#functional-requirements` | Automatic timestamps | T01 | TC-04 |
| FR-07 | `prd.md#functional-requirements` | One JSON per feature in the configured folder | T02 | TC-09, TC-12 |
| FR-08 | `prd.md#functional-requirements` | Reply text or error | T02 | TC-05, TC-06 |
| FR-09 | `prd.md#functional-requirements` | Band | T03 | TC-08, TC-14 |
| FR-10 | `prd.md#functional-requirements` | Band press and command open the pane | T04 | TC-15 |
| FR-11 | `prd.md#functional-requirements` | Pane feature list and Done section | T04 | TC-08, TC-16 |
| FR-12 | `prd.md#functional-requirements` | Task rows and groups | T04 | TC-08, TC-16 |
| FR-13 | `prd.md#functional-requirements` | `n/m` count | T02, T03 | TC-06 |
| FR-14 | `prd.md#functional-requirements` | Stale marker and timer | T03 | TC-07, TC-17 |
| FR-15 | `prd.md#functional-requirements` | Link with `editor` | T05 | TC-18 |
| FR-16 | `prd.md#functional-requirements` | Read at start, on Refresh, no polling | T02, T04 | TC-13, TC-24 |
| FR-17 | `prd.md#functional-requirements` | Clean command | T05 | TC-11, TC-19 |
| FR-18 | `prd.md#functional-requirements` | Unreadable file | T02, T04 | TC-09, TC-12, TC-16 |
| FR-19 | `prd.md#functional-requirements` | Skills call the tool, both variants | T07, T08 | TC-20, TC-21 |
| FR-20 | `prd.md#functional-requirements` | State mapping | T07, T08, T09 | TC-20, TC-21, TC-22 |
| FR-21 | `prd.md#functional-requirements` | README contract | T06 | FR-21 review |
| FR-22 | `prd.md#functional-requirements` | Option and command to hide the band | T10, T09 | TC-26, TC-27 |
| FR-23 | `prd.md#functional-requirements` | Modern drawing, pane background, icon set | T11, T09 | TC-28, T09.6 screenshots |
| NFR-01 | `prd.md#non-functional-requirements` | Supported API only | T01 … T05 | QA-05, QA-06, `claude plugin validate` |
| NFR-02 | `prd.md#non-functional-requirements` | No periodic disk read | T02, T03 | TC-13 |
| NFR-03 | `prd.md#non-functional-requirements` | 4 MiB guard | T02 | TC-10 |
| NFR-04 | `prd.md#non-functional-requirements` | Icon and word per kind, no animation | T03, T04 | TC-14, TC-16 |
| NFR-05 | `prd.md#non-functional-requirements` | Narrow widths | T03, T04 | TC-14, TC-16 |
| NFR-06 | `prd.md#non-functional-requirements` | English UI text | T01 … T06 | review |
| NFR-07 | `prd.md#non-functional-requirements` | Windows, macOS, Linux | T05 | TC-11, TC-18 |
| NFR-08 | `prd.md#non-functional-requirements` | Skills safe without the mod | T07, T08, T09 | TC-20, TC-21, TC-25 |
| NFR-09 | `prd.md#non-functional-requirements` | Validation and tests pass | T01 … T06 | `claude plugin validate`, `claude plugin test feature-progress` |
| DEC-01 | `techspec.md#technical-decisions` | Storage exception recorded in the rule | T02, T06 | review of `mod-runtime.md` |
| DEC-02 … DEC-04 | `techspec.md#technical-decisions` | Reply shape, read-merge-write, id regex | T01, T02 | TC-01, TC-05, TC-12 |
| DEC-05 | `techspec.md#technical-decisions` | Delete argv in the folder | T05 | TC-11 |
| DEC-06 | `techspec.md#technical-decisions` | Band composes with `next(e)` | T03 | TC-14 |
| DEC-07 | `techspec.md#technical-decisions` | Injected `now`, ISO timestamps | T01 | TC-04 |
| DEC-08 | `techspec.md#technical-decisions` | Copied `editor` logic | T05 | TC-18 |
| DEC-09 | `techspec.md#technical-decisions` | Reload after the session switch | T02 | TC-23 |
| DEC-10 | `techspec.md#technical-decisions` | One minute timer, no disk read | T03 | TC-13, TC-17 |
| DEC-11, DEC-12 | `techspec.md#technical-decisions` | One protocol file per variant; no QA in Portuguese | T07, T08 | TC-20, TC-21 |
| DEC-13 | `techspec.md#technical-decisions` | `showBand` in `userConfig`, flipped by the command through `$.config.set` | T10 | TC-26 |
| DEC-14 | `techspec.md#technical-decisions` | Terminal paint, glyph per icon set, chips, text meters, frames from 44 columns | T11 | TC-28 |
| TC-01 … TC-04 | `techspec.md#test-approach` | Report model | T01 | `tests/report.test.ts` |
| TC-05, TC-09, TC-10, TC-12, TC-13 | `techspec.md#test-approach` | Tool, storage, load | T02 | `tests/register.test.ts`, `tests/store.test.ts` |
| TC-06 … TC-08, TC-14, TC-17 | `techspec.md#test-approach` | Derived values and band | T02, T03 | `tests/progress.test.ts`, `tests/band.test.ts` |
| TC-15, TC-16 | `techspec.md#test-approach` | Pane and toggle | T04 | `tests/register.test.ts`, `tests/pane.test.ts` |
| TC-11, TC-18, TC-19 | `techspec.md#test-approach` | Clean and link | T05 | `tests/store.test.ts`, `tests/viewer.test.ts`, `tests/register.test.ts` |
| TC-20 | `techspec.md#test-approach` | English skills | T07 | `rg -n "progress-report.md" .agents/skills` |
| TC-21 | `techspec.md#test-approach` | Portuguese skills | T08 | `rg -n "relatorio-progresso.md" SKILLS` |
| TC-22 … TC-25, TC-27 | `techspec.md#test-approach` | Real-session acceptance | T09 | manual script |
| TC-26 | `techspec.md#test-approach` | Hidden band and the `band` command | T10 | `tests/settings.test.ts`, `tests/band.test.ts`, `tests/register.test.ts` |
| TC-28 | `techspec.md#test-approach` | Drawing, `paneBackground`, `icons` | T11 | `tests/settings.test.ts`, `tests/pane.test.ts`, `tests/band.test.ts`, `tests/progress.test.ts` |

## Tasks

- [T01 — Scaffold the mod and the report model](done/task_01.md): the mod loads and validates, and `report.ts` parses, merges, removes and stamps a report.
- [T02 — Store reports through the tool](done/task_02.md): the tool writes the feature file with read-merge-write and replies; the mod loads the folder at start and after `/clear` or `/resume`.
- [T03 — Draw the band](done/task_03.md): the band shows the latest open feature, its stage, `n/m` and the stale marker, above the other bands.
- [T04 — Draw the pane and the toggle command](done/task_04.md): `/feature-progress` and the band open the pane with features, grouped task rows, warnings and Refresh.
- [T05 — Open task links and clean done features](done/task_05.md): the link control opens a file with the `editor` option, and `/feature-progress clean` deletes done features' files.
- [T06 — Document and register the mod](done/task_06.md): README with the contract, marketplace and root README rows, and the `mod-runtime.md` exception.
- [T07 — Report progress from the English SDD skills](done/task_07.md): one protocol file and links at every transition in `.agents/skills`.
- [T08 — Report progress from the Portuguese SDD skills](done/task_08.md): the same protocol in Portuguese, without QA, on a branch of `D:\Projetos\agents-instructions`.
- [T09 — Accept the mod in a real session](done/task_09.md): a real flow run, `/clear`, Refresh across sessions, a skill run without the mod and the hidden band; the README states the tested version.
- [T10 — Hide the band](done/task_10.md): the `showBand` option and `/feature-progress band`, with tests and README rows (W-09).
- [T11 — Modern drawing, pane background and icon set](done/task_11.md): chips, meters, framed cards, the `paneBackground` and `icons` options (W-10).

## Coverage gate

- Coverage: pass. Every OBJ, US, FR, NFR, DEC and TC maps to at least one task.
- Traceability: pass. Each task lists its sources; the matrix above lists every PRD and TechSpec ID.
- Dependencies: pass. The graph is acyclic; T07 depends only on the stable tool contract (T02) and runs before or after T03 … T06.
- Atomicity: pass. Each task delivers one reviewable behavior with its tests; T01 is the only foundation and unlocks every mod task.
- Executability: pass. Commands come from `AGENTS.md`: `claude plugin validate .`, `claude plugin validate feature-progress`, `claude plugin test feature-progress`, `tsc -p feature-progress` (TypeScript 7.0.2, after one load).
- Validation profile: pass. Unit tests for helpers with a fake `Host`; kit tests on `terminal` and `desktop` for hooks and drawing; manual real-session scripts in T09. macOS and Linux runs stay unverified (argv covered by unit tests), as the TechSpec records.
- Idempotency: pass. Registrations repeat safely on reload; a repeated report changes only `updatedAt`; clean deletes only done features' files.

## Assumptions and open items

- Assumption: T07 and T08 change skill text only; their verification is a review plus `rg`, and the real effect shows in T09.
- Required environment: T08 needs write access to `D:\Projetos\agents-instructions` (branch `feat/relatorio-progresso` from `master`, PR to `ColibriAgile/agents-instructions`); the user authorized the change in the grilling session (2026-10-24). Pushing and opening the PR need the user's go-ahead at that time.
- Required environment: T09 needs a real Claude Code session with the mod installed from the folder marketplace (`--scope user`) and the user's hands on `/clear`, `/resume` and a second session.

## State

- [x] T01 — completed (handoff in `done/task_01.md`)
- [x] T02 — completed (handoff in `done/task_02.md`)
- [x] T03 — completed (handoff in `done/task_03.md`)
- [x] T04 — completed (handoff in `done/task_04.md`)
- [x] T05 — completed (handoff in `done/task_05.md`)
- [x] T06 — completed (handoff in `done/task_06.md`)
- [x] T07 — completed (handoff in `done/task_07.md`)
- [x] T08 — completed (handoff in `done/task_08.md`)
- [x] T09 — completed again (handoff in `done/task_09.md`; T09.6 closed by codereview_01/task_12)
- [x] T10 — completed (handoff in `done/task_10.md`)
- [x] T11 — completed (handoff in `done/task_11.md`)

## Problems and solutions

- T09 reopened (codereview_01/CR-01, 2026-10-25): T09.6 was ticked while its handoff and W-11 kept the screenshots and the visual check of the 0.3.0 drawing open. Previous handoff kept in `task_09.md`. It closes again with the `claude --debug` result and the screenshots (codereview_01/task_12).
