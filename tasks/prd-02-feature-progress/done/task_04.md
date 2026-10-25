# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T04 — Draw the pane and the toggle command

## Outcome

`/feature-progress` opens the pane, or closes it when it is open; pressing the band opens it. The pane has a Refresh control, one block per open feature (latest first and expanded, others collapsed), a collapsed Done section, a warning row per unreadable file, and an empty state. Task rows show glyph and word, `#round`, a steps bar with `done/total`, the duration and the note; tasks group by `group` in first-seen order.

## Dependencies and boundaries

- Depends on: T03
- Unblocks: T05
- In scope: `pane.tsx`, the `Pane` render hook, the `feature-progress` command registration and its toggle branch, the band button that opens the pane, the Refresh button that calls `loadAll`.
- Out of scope: the link control and the `clean` argument (T05).

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-10, FR-11, FR-12, FR-16 (Refresh), FR-18 (warning rows) | `prd.md#functional-requirements` | Toggle, pane layout, task rows, Refresh, warnings |
| NFR-04, NFR-05 | `prd.md#non-functional-requirements` | Icon and word; frames dropped below 44 columns |
| CMP-11 (pane), CMP-12 | `techspec.md#components-and-flow` | Pane and command flow |
| TC-15, TC-16 | `techspec.md#test-approach` | Toggle and pane tests |

## Context to recover on demand

- Applicable skills and rules: `ts-tests`; `.agents/rules/pane-ui.md`, `tests.md` (find and press by `key`).
- Existing code: `session-info/hooks/cards.tsx:12-106` (frames, narrow widths), `session-info/hooks/register.tsx:1198` (command opens the pane), `:1479` (`Pane` render hook).
- Contract or integration: `techspec.md#contracts-and-data` (Command), `prd.md#user-experience`.
- Engine reference: `$.command.register` (`argumentHint`), `command.run`, `$.ui.open` / `$.ui.close` (returns whether drawn), `ui.render` `Pane`.

## Work

- [x] T04.1 Create `hooks/pane.tsx` that draws from plain values and callbacks (Refresh, expand, collapse).
- [x] T04.2 In `register.tsx`, register the command in `session.start` (`argumentHint: '[clean]'`), add the `command.run` toggle with its `.catch`, the `Pane` render hook, and the `isPaneOpen` flag.
- [x] T04.3 Make the band a button that opens the pane; toast when `$.ui.open` reports the pane was not drawn.
- [x] T04.4 Write `tests/pane.test.ts` (TC-16) on both surfaces and extend `tests/register.test.ts` (TC-15, Refresh reads the folder once).

## Acceptance criteria

- With 2 open and 1 done feature, the pane shows 2 feature blocks (latest expanded) and a collapsed Done section.
- A task with `active` and `steps {2, 5}` shows the active glyph and word, a bar and `2/5`; tasks with `group: "Review #1"` show under that heading after the ungrouped tasks.
- An unreadable file shows one warning row with its path.
- With no feature, the pane shows `No feature has reported progress yet.`
- The second `/feature-progress` closes the pane; any other argument answers the usage line.
- Refresh reads the folder once and redraws.

## Verification

- Unit: not applicable beyond T03 helpers.
- Kit: `tests/pane.test.ts` and `tests/register.test.ts` on `terminal` and `desktop`.
- Real session: look of the pane checked in T09.
- Manual: not applicable.
- Platforms: surface-neutral.
- Commands: `claude plugin validate feature-progress`, `claude plugin test feature-progress`, `tsc -p feature-progress`.
- Environment dependency: none.
- Expected evidence: tests pass; `claude plugin validate feature-progress` lists `command.run` with `.catch`.

## Affected files

- Create: `feature-progress/hooks/pane.tsx`, `feature-progress/tests/pane.test.ts`
- Modify: `feature-progress/hooks/register.tsx`, `feature-progress/hooks/band.tsx`, `feature-progress/tests/register.test.ts`

## Observability and recovery

- Operational signal: the pane; toast when the pane cannot open.
- Recovery: revert the task's commit.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: `/feature-progress` (registered at `session.start`, `argumentHint: '[clean]'`) opens the pane or closes it, and answers the usage line for another argument; pressing the band opens the pane; a pane the terminal cannot place toasts `feature-progress: widen the terminal to open the pane.`. The pane draws Refresh, a warning row per unreadable file, the empty state, open features latest first (the first expanded), task rows with glyph, id, title, stage, steps bar, duration and note, groups after the ungrouped tasks, and a collapsed `Done (N)` section. Refresh calls `loadAll` once.
- Changed files: created `feature-progress/hooks/pane.tsx`, `feature-progress/tests/pane.test.ts`; modified `feature-progress/hooks/{band.tsx,progress.ts,register.tsx}`, `feature-progress/types/index.d.ts`.
- Checks: `claude plugin test feature-progress` 62 pass, 0 fail (pane on `terminal` and `desktop`); `claude plugin validate feature-progress` passed, `command.run` and `tool.call` with `.catch`; `tsc -p feature-progress` exit 0. Quality profile: no blocking hit. Reservations: QA-10 false positives at `hooks/pane.tsx:38,59` and `hooks/band.tsx:17` (destructured parameters; at most 3 each).
- Validated state: Windows 11, Claude Code 2.1.310. Deviation recorded: the TechSpec's `$.state` key `isPaneOpen` became `toggled` (feature ids and the Done section the person expanded or collapsed); whether the pane is open comes from `$.ui.panes()`, the engine's record, which survives a module reload. A `Button` holds only `Text`, so the band is a row `Box` around one `Button`.
- Open items: none.

### ADR candidates

None - direct TechSpec implementation or local decision.
