# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T10 — Hide the band

## Outcome

A `userConfig` boolean `showBand` (default `true`) hides the band when `false`. `/feature-progress band` flips the option through `$.config.set`, so the value persists across `/clear`, `/resume` and new sessions. The pane, the reports and the other commands work while the band is hidden. The README documents the option and the command.

## Dependencies and boundaries

- Depends on: T06
- Unblocks: T09
- In scope: `plugin.json` field and version, `settings.ts`, the `AbovePrompt` hook and the command in `register.tsx`, tests, README rows.
- Out of scope: a band toggle in the pane; per-feature hiding.

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-22 | `prd.md#functional-requirements` | Option and command to hide the band |
| DEC-13 | `techspec.md#technical-decisions` | `showBand` read per load; command flips it through `$.config.set` |
| TC-26 | `techspec.md#test-approach` | Unit and kit tests |
| W-09 | `workflow.md` | Scope and form decided by the user |

## Context to recover on demand

- Applicable skills and rules: `.agents/rules/mod-hooks.md` (`userConfig` fields), `ts-tests`.
- Existing code: `session-info/hooks/register.tsx:1755` and `topic-guard/hooks/register.tsx:243` (`$.config.set`), `session-info/tests/tabs.test.ts:61` (a `config.set` hook in a kit test).
- Contract or integration: `techspec.md#contracts-and-data` (`userConfig`, Command).
- Engine reference: `feature-progress/.claude-plugin/types/claude-code/index.d.ts:9706` (options reload the plugin), `:3194-3205` (`$.config.set`).

## Work

- [x] T10.1 Add `showBand` to `plugin.json` and `settingsOf`, with its default constant.
- [x] T10.2 Return `next(e)` from the `AbovePrompt` hook when `showBand` is `false`.
- [x] T10.3 Add `band` to the command: flip the value with `$.config.set`, answer the new state or the deny reason; update the description, argument hint and usage line.
- [x] T10.4 Tests for TC-26.
- [x] T10.5 README: Settings row, Use row, band bullet; bump `version` to `0.2.0`.

## Acceptance criteria

- `settingsOf({})` gives `showBand: true`; `showBand: false` is kept.
- With `showBand: false` and an open feature, the band hook adds nothing above `next(e)`.
- `/feature-progress band` calls `config.set` with `feature-progress.showBand` and the flipped value, and answers the new state; a deny answers its reason.

## Verification

- Unit: `tests/settings.test.ts`.
- Kit: `tests/band.test.ts`, `tests/register.test.ts`.
- Real session: TC-27 in T09.
- Commands: `claude plugin validate .`, `claude plugin validate feature-progress`, `claude plugin test feature-progress`.
- Expected evidence: test counts in the handoff.

## Affected files

- Modify: `feature-progress/.claude-plugin/plugin.json`, `feature-progress/hooks/settings.ts`, `feature-progress/hooks/register.tsx`, `feature-progress/tests/settings.test.ts`, `feature-progress/tests/band.test.ts`, `feature-progress/tests/register.test.ts`, `feature-progress/README.md`

## Observability and recovery

- Operational signal: the command's answer and the `/config` row.
- Recovery: set `showBand` to `true` in `/config`.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: `showBand` (boolean, default `true`) in `userConfig` and `Settings`; the `AbovePrompt` hook returns `next(e)` when it is off; `/feature-progress band` flips it through `$.config.set({ key: 'feature-progress.showBand' })` and answers `Feature progress band hidden.` / `Feature progress band shown.`, or `feature-progress: <deny>`. Command description, argument hint `[band|clean]` and usage line updated. README: band bullet, Use row, Settings row. Version `0.1.0` → `0.2.0`.
- Changed files: `feature-progress/.claude-plugin/plugin.json`, `feature-progress/hooks/settings.ts`, `feature-progress/hooks/register.tsx`, `feature-progress/tests/settings.test.ts`, `feature-progress/tests/band.test.ts`, `feature-progress/README.md`. TC-26's command tests live in `band.test.ts`, not `register.test.ts`, next to the other band tests.
- Checks: `claude plugin test feature-progress` 75 pass, 0 fail (71 before; 4 new TC-26 tests, 3 settings tests updated); `claude plugin validate .` and `claude plugin validate feature-progress` pass; `tsc -p feature-progress --noEmit` (TypeScript 5.6.3) no error.
- Validated state: working tree on base `e58daa9`, Windows 11, kit surfaces terminal (band and command).
- Open items: TC-27 runs in T09 (real session). Deleted before TC-27: stale compiled `.js` files from the T01 scaffold (`hooks/register.js`, `host.js`, `paths.js`, `report.js`, `settings.js`; `tests/paths.test.js`, `report.test.js`, `settings.test.js`), each next to its `.ts` source; `hooks/settings.js` had no `showBand`, so a host that loads `.js` first would fail TC-27. Tests and validation pass after the delete. The reload re-runs `session.start` for this plugin alone (`index.d.ts`, `'session.start'`: "once per fresh load … a reload"), so the band comes back with the loaded features. Watch in TC-27: the command answers after `$.config.set`; if the line does not print, a toast before the set is the fix.

### ADR candidates

None - direct TechSpec implementation (DEC-13).
