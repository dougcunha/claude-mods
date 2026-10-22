# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/prd.md`
2. `tasks/prd-01-visual-review/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T03 — View model with exact numbers

## Outcome

When the mod accepts a model, it reads the hunks with `git diff -U0`, calculates the unit line deltas, the file rest lines, Ce and Ca, builds the view model (units by container, relations, table layer, entity links, other files), and writes `<TEMP>/claude-visual-review/<session id>/view.json`. The tool result names the file.

## Dependencies and boundaries

- Depends on: T02
- Unblocks: T04
- In scope: hunk parser, `metrics.ts`, `view.ts` without comments, temp folder path, file write, tool result.
- Out of scope: the server and the browser (T04); comments in the view model (T06); drawing (T05).

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| OBJ-01, OBJ-04 | `prd.md#outcomes-and-metrics` | Coverage on the page, exact numbers |
| FR-07 to FR-13, FR-15 to FR-17 | `prd.md#functional-requirements` | View model content |
| NFR-04 | `prd.md#non-functional-requirements` | Determinism |
| DEC-03, DEC-07, DEC-08, DEC-09 | `techspec.md#technical-decisions` | File in temp folder, logic in helpers, ranges, accepted model text in temp |
| CMP-03, CMP-05, CMP-06 | `techspec.md#components-and-flow` | Hunks, metrics, view |
| TC-06 (file write), TC-07, TC-08, TC-09, TC-10 | `techspec.md#test-approach` | Deltas, Ce/Ca, fixtures, containers |

## Context to recover on demand

- Applicable skills and rules: `.agents/rules/mod-runtime.md` ("Files"), `code-standards.md` ("Sensitive data"), `tests.md`.
- Existing code: `session-info/hooks/git.ts:50` (temp folder from `TEMP` / `TMPDIR`), `session-info/hooks/paths.ts` (`norm`, path helpers; copy what is needed, do not import across mods).
- Contract or integration: `techspec.md#contracts-and-data` (Ce/Ca rule, coverage), `techspec.md#integrations-and-interfaces` (Git commands 5–6), `techspec.md#errors-security-and-recovery` (binary file, 4 MiB file, truncated output).
- Engine reference: `$.fs.write`, `$.fs.read` (4 MiB limit), `$.env.get`, `$.session.id`.

## Work

- [x] T03.1 Add the `-U0` hunk parser to `hooks/git.ts`, with truncated output as "unit deltas unknown".
- [x] T03.2 Create `hooks/metrics.ts`: unit deltas from hunks and ranges, file rest lines, Ce and Ca.
- [x] T03.3 Create `hooks/view.ts`: the view model type and builder; containers with closed defaults; table layer and entity links; other files.
- [x] T03.4 In `register.tsx`: on an accepted model, build and write `view.json`; return the path in the result. Extend `Host` with `writeFile`, `env`, `sessionId`.
- [x] T03.5 Write fixtures for C#, TypeScript and Python models and `tests/metrics.test.ts` (TC-07, TC-08), `tests/view.test.ts` (TC-09, TC-10); extend TC-06 for the write.

## Acceptance criteria

- For a file with 1 unit, the unit delta equals the file numstat; for many units, unit deltas plus rest equal the file numstat.
- Ce and Ca ignore removed relations, self relations and duplicates.
- A container with only context units is closed in the view model.
- A changed `README.md` is in the other files list.

## Verification

- Unit: TC-07, TC-08, TC-09, TC-10.
- Kit: TC-06 with a fake `writeFile` that records the path and checks the JSON parses.
- Real session: run `/visual-review` and open `view.json` from the temp folder; check the counts against `git diff --numstat`.
- Manual: not applicable.
- Platforms: Windows; path helpers tested with both separators and a path with spaces.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Environment dependency: none.
- Expected evidence: test count and exit code 0; `view.json` in the temp folder.

## Affected files

- Modify: `visual-review/hooks/git.ts`, `visual-review/hooks/register.tsx`, `visual-review/hooks/host.ts`, `visual-review/tests/git.test.ts`, `visual-review/tests/visual-review.test.ts`
- Create: `visual-review/hooks/metrics.ts`, `visual-review/hooks/view.ts`, `visual-review/hooks/paths.ts`, `visual-review/tests/metrics.test.ts`, `visual-review/tests/view.test.ts`

## Observability and recovery

- Operational signal: the tool result names the written file.
- Recovery: the temp folder can be deleted at any time; the next run writes it again.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: an accepted model now becomes a view model. The tool reads the changed files (`--numstat`, untracked files) and the `-U0` hunks from Git again, calculates each unit's lines, added and removed lines inside its ranges, each file's lines outside every unit, and Ce and Ca from the live relations; groups the units in containers (closed when they hold only context units); adds the table layer, the entity links, and the other files (non-source files and skipped files with their reason); and writes `<temp>/claude-visual-review/<session id>/view.json`. The tool result names the file.
- Changed files: created `visual-review/hooks/metrics.ts`, `hooks/view.ts`, `tests/metrics.test.ts`, `tests/view.test.ts`; modified `hooks/git.ts` (`changedFiles`, `parseHunks`, `diffHunks`), `hooks/paths.ts` (`tempRoot`, `sessionDir`), `hooks/host.ts` (`writeFile`, `env`, `sessionId`), `hooks/register.tsx`, `hooks/prompts.ts` (`acceptedResult`), `tests/git.test.ts`, `tests/visual-review.test.ts`, `README.md`.
- Checks:
  - `claude plugin validate visual-review`: passed.
  - `claude plugin test visual-review`: 56 pass, 0 fail, exit 0 (6 files).
  - `tsc -p visual-review`: exit 0.
  - Manual mutant pass: the range overlap without its `+ 1` failed TC-04 and TC-07; skipping hunk lines by count disabled failed TC-04; `every` to `some` for a closed container survived at first, so TC-10 now has a container that mixes a context unit and changed units, and the mutant fails it. All reverted (`grep` shows none left), suite green.
  - Real session (stream-json headless, sample TypeScript repository with 1 untracked new class and 1 modified class, `--plugin-dir visual-review`): the tool wrote `C:/Users/Admin/AppData/Local/Temp/claude-visual-review/<session id>/view.json`. Against `git diff --numstat HEAD` (`4 0 src/item.ts`): `src/item.ts` unit `Item` 4 added + rest 0 = 4; untracked `src/cart.ts` (13 lines) unit `Cart` 11 + rest 2 = 13; Ce/Ca 1/0 and 0/1 match the 1 composition relation.
  - Quality profile: QA-01 to QA-06 no hit. QA-07: 7 reservation hits, none a real violation: 3 throws inside test fakes (`tests/visual-review.test.ts:62`, `:67`, `tests/model.test.ts:116`), and 4 matches of the 4-parameter pattern on a `for` destructuring (`tests/visual-review.test.ts:126`) and on 1 destructured object parameter (`hooks/view.ts:105`, `:197`, `hooks/model.ts:321`). The real 4-parameter test builders were changed to take fewer parameters.
- Validated state: base `8d5ddeb` plus the T01 to T03 diff; Windows 11, Claude Code 2.1.308, Git for Windows, kit tests on `terminal` and `desktop`.
- Open items:
  - The diff command is `git -c core.quotePath=false diff -U0 --no-color -M <base>`: the `-c` read-only override keeps non-ASCII names as they are, so a name matches the `--numstat -z` path. AUTO-09.
  - A unit's delta counts the hunks inside its range; with nested units (an inner class), both count the inner lines, and the rest counts only lines outside every range. The sum then exceeds the file total by the nested lines. AUTO-09.
  - Untracked files have no `git diff` hunks; the mod treats each as 1 hunk of its Git line count.
  - The view model has no time stamp, so 2 builds of the same input give the same bytes (NFR-04).
  - In the real run the analysis used unit ids with `#` (`src/cart.ts#Cart`); T06 must keep anchors as `{ kind, id }` and not split ids on `#`.

### ADR candidates

None - direct TechSpec implementation or local decision.
