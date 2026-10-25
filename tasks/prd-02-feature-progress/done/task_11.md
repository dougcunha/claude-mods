# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T11 — Modern drawing, pane background and icon set

## Outcome

The band and the pane have a modern look: the stage as a colored chip, meters of done tasks and steps, framed feature cards that light in the state color on hover, colored state glyphs, group titles with a count, and an `↗ open` link. `paneBackground` paints the pane body in the terminal, as in session-info. `icons` picks `unicode`, `nerd` or `emoji` glyphs. The README documents the drawing and the 2 options.

## Dependencies and boundaries

- Depends on: T10
- Unblocks: T09 (T09.6 screenshots show this drawing)
- In scope: `icons.ts`, `meter.tsx`, `band.tsx`, `pane.tsx`, `progress.ts` (meter helpers), `settings.ts`, the `Pane` and `AbovePrompt` hooks in `register.tsx`, `plugin.json` (options, version `0.3.0`), tests, README.
- Out of scope: a background for the band; hex colors per state; a new report field.

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-23 | `prd.md#functional-requirements` | Modern look, `paneBackground`, `icons` |
| DEC-14 | `techspec.md#technical-decisions` | Paint on the terminal only; glyph per set; chip and text meters; frames from 44 columns, inline details from 64 |
| NFR-04, NFR-05 | `prd.md#non-functional-requirements` | Glyph and word per state; narrow widths |
| TC-28 | `techspec.md#test-approach` | Unit and kit tests |
| W-10 | `workflow.md` | Scope decided by the user |

## Context to recover on demand

- Applicable skills and rules: `.agents/rules/pane-ui.md`, `ts-tests`.
- Existing code: `session-info/hooks/register.tsx:2678` (pane paint), `session-info/hooks/cards.tsx:37` (card frame and hover), `session-info/hooks/icons.ts` (icon sets).
- Engine reference: `feature-progress/.claude-plugin/types/claude-code/index.d.ts` (`BoxProps`, `BoxHoverProps`, `TextProps`, `ThemeKey`).

## Work

- [x] T11.1 `paneBackground` and `icons` in `plugin.json` and `settingsOf`.
- [x] T11.2 `KIND_STYLE` per icon set, `styleOf`, `glyphColumns`; theme colors re-mapped (`qa` → `merged`, `waiting` → `planMode`, `active` glyph `●`).
- [x] T11.3 Band: glyph, title, chip, meter, count, stale marker; the meter drops before the title shortens.
- [x] T11.4 Pane: header with `↻ Refresh` and counts, framed cards, feature meter with percent, task rows inline from 64 columns, group titles with a count, Done header with the done glyph; paint on the terminal.
- [x] T11.5 Tests, README, version `0.3.0`.

## Acceptance criteria

- TC-28 passes on terminal and desktop.
- Every state still has a glyph and a word (NFR-04).
- `claude plugin validate .`, `claude plugin validate feature-progress`, `claude plugin test feature-progress` and `tsc -p feature-progress` pass.

## Verification

- Unit: `tests/settings.test.ts`, `tests/progress.test.ts`.
- Kit: `tests/band.test.ts`, `tests/pane.test.ts` on terminal and desktop.
- Real session: the paint and the glyphs show only in a real terminal; checked in T09.6 with `claude --debug` and screenshots.

## Affected files

- Modify: `feature-progress/.claude-plugin/plugin.json`, `feature-progress/hooks/{icons.ts,band.tsx,pane.tsx,progress.ts,settings.ts,register.tsx}`, `feature-progress/tests/{settings,band,pane,progress}.test.ts`, `feature-progress/README.md`
- Create: `feature-progress/hooks/meter.tsx`

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: the drawing above, the 2 options, README rows (What it does, States table with glyph, emoji and color, Settings, Source files), version `0.2.0` → `0.3.0`. `stepsBar` and `bandDetail` are gone; `filledCells`, `percentText`, `METER_CELLS`, `METER_FILLED`, `METER_EMPTY` replace them.
- Changed files: as listed under Affected files.
- Checks: `claude plugin test feature-progress` 81 pass, 0 fail (75 before; 6 new tests, 9 updated); `claude plugin validate .` and `claude plugin validate feature-progress` pass (the `ICON_MISSING` plugin-directory warning is not a failure); `tsc -p feature-progress` no error.
- Validated state: working tree on base `e58daa9`, Windows 11, kit surfaces terminal and desktop.
- Open items: the kit does not draw paint. The real look (chip colors, frame hover, `nerd` glyphs in a Nerd Font, emoji width) needs a real session with `claude --debug` and the T09.6 screenshots. The `nerd` codepoints are Font Awesome 4 ones (`f10c`, `f14e`, `f144`, `f06e`, `f0ad`, `f0c3`, `f252`, `f05e`, `f058`), not seen in a real Nerd Font yet.

### ADR candidates

None - direct TechSpec implementation (DEC-14).
