# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T03 — Draw the band

## Outcome

The band above the prompt shows the open feature with the latest `updatedAt`: title, stage (`label` or kind word, `#round`), `n/m`, and the stale marker past the `staleMinutes` limit. The band draws above the tree of the next hook, yields to a survey, and disappears when no feature is open. A one-minute timer redraws the relative values without a disk read.

## Dependencies and boundaries

- Depends on: T02
- Unblocks: T04
- In scope: `progress.ts` (`isStale`, `latestOpen`, `orderFeatures`, `groupTasks`, `agoText`, `durationText`), `icons.ts` (`KIND_STYLE`), `band.tsx`, the `ui.render` hook on `AbovePrompt`, the timer in `session.start`.
- Out of scope: pressing the band to open the pane (T04, which owns the pane), the pane itself.

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-09, FR-13, FR-14 | `prd.md#functional-requirements` | Band, count, stale marker |
| NFR-02, NFR-04, NFR-05 | `prd.md#non-functional-requirements` | No disk read on ticks; icon and word; narrow width |
| DEC-06, DEC-10 | `techspec.md#technical-decisions` | Compose with `next(e)`; one-minute timer |
| CMP-04, CMP-10, CMP-11 (band) | `techspec.md#components-and-flow` | Derived values, kind table, band |
| TC-06, TC-07, TC-08, TC-14, TC-17 | `techspec.md#test-approach` | Derived values and band tests |

## Context to recover on demand

- Applicable skills and rules: `ts-tests`; `.agents/rules/pane-ui.md` (surfaces, status and accessibility), `tests.md` (drawing on both surfaces).
- Existing code: `session-info/hooks/icons.ts` (`STATUS` glyph, letter and color table), `session-info/hooks/cards.tsx` (width steps).
- Contract or integration: `techspec.md#components-and-flow` (Draw flow), `techspec.md#errors-security-and-recovery`.
- Engine reference: `ui.render` `AbovePrompt` props (`hasSurvey`, `bodyColumns`), `RenderResultOf`, `$.ui.resolve`, `$.clock.every`, `$.ui.invalidate`.

## Work

- [x] T03.1 Add the derived helpers to `hooks/progress.ts` with `now` and `staleMinutes` as arguments.
- [x] T03.2 Create `hooks/icons.ts` with `KIND_STYLE` `satisfies Record<Kind, …>`.
- [x] T03.3 Create `hooks/band.tsx` that draws one line from plain values and shortens the title first on a narrow `bodyColumns`.
- [x] T03.4 In `register.tsx`, add the `AbovePrompt` hook (DEC-06) and the `$.clock.every(60_000)` timer that invalidates only when an open feature exists.
- [x] T03.5 Extend `tests/progress.test.ts` (TC-06 … TC-08) and write `tests/band.test.ts` (TC-14, TC-17) on `terminal` and `desktop`.

## Acceptance criteria

- With 2 open features, the band shows the one updated last; with none, the hook returns `next(e)` unchanged.
- With `hasSurvey`, the hook returns `next(e)` alone.
- Each stage shows a glyph and a word; color only reinforces it.
- The stale marker shows past the limit for a feature not `done` and not `waiting`; `staleMinutes: 0` shows none.
- A timer tick causes no file read.

## Verification

- Unit: `tests/progress.test.ts`.
- Kit: `tests/band.test.ts` on `terminal` and `desktop`, with `mock.clock(on)` for TC-17.
- Real session: look of the band checked in T09 with `claude --debug` (no `ui.render ... refused`).
- Manual: not applicable.
- Platforms: surface-neutral.
- Commands: `claude plugin validate feature-progress`, `claude plugin test feature-progress`, `tsc -p feature-progress`.
- Environment dependency: none.
- Expected evidence: tests pass on both surfaces.

## Affected files

- Create: `feature-progress/hooks/icons.ts`, `feature-progress/hooks/band.tsx`, `feature-progress/tests/band.test.ts`
- Modify: `feature-progress/hooks/progress.ts`, `feature-progress/hooks/register.tsx`, `feature-progress/tests/progress.test.ts`

## Observability and recovery

- Operational signal: the band itself.
- Recovery: revert the task's commit.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: the `AbovePrompt` hook draws one line (kind glyph, title cut to fit, stage with `#round`, `n/m`, `⚠ stale`) above the tree `next(e)` resolves to, returns `next(e)` alone during a survey or with no open feature. A `$.clock.every(60_000)` timer started in `session.start` invalidates the render only when an open feature exists, and reads no file. `progress.ts` gained `orderFeatures`, `latestOpen`, `isStale`, `groupTasks`, `agoText`, `durationText`, `fitTitle`, `bandDetail`; `icons.ts` holds `KIND_STYLE`.
- Changed files: created `feature-progress/hooks/{icons.ts,band.tsx}`, `feature-progress/tests/band.test.ts`; modified `feature-progress/hooks/{progress.ts,register.tsx}`, `feature-progress/tests/progress.test.ts`.
- Checks: `claude plugin test feature-progress` 54 pass, 0 fail (band on `terminal` and `desktop`); `claude plugin validate feature-progress` passed; `tsc -p feature-progress` exit 0. Quality profile: no blocking hit (`hooks/icons.ts:1` is an `import type`, which the profile excludes). Reservations: QA-10 false positive at `hooks/band.tsx:17` (2 destructured parameters).
- Validated state: Windows 11, Claude Code 2.1.310. The kit drops `key` from `Text` elements, so tests find texts by content; the kit needs a test `ui.render` hook to stand for the engine's own band beneath the plugins.
- Open items: what the real engine resolves `next(e)` to when no other mod draws the band is not declared; T09 checks the look with `claude --debug`.

### ADR candidates

None - direct TechSpec implementation or local decision.
