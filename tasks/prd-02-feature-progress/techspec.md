# TechSpec — feature-progress

## Sources and traceability

- PRD: `tasks/prd-02-feature-progress/prd.md` (approved 2026-10-25).
- Applicable instructions, rules, and skills: `AGENTS.md`; `.agents/rules/code-standards.md`, `javascript-typescript.md`, `mod-hooks.md`, `mod-runtime.md`, `pane-ui.md`, `tests.md`; `ts-tests` for test depth during execution.
- Research: engine declarations in `session-info/.claude-plugin/types/claude-code/index.d.ts` (the new mod gets its own copy at first load): `$.fs` (3298-3425, `write` creates parent directories, 4 MiB limit), `$.clock.now/after/every` (3509-3540), `$.process.run` (3590), `$.command.register` and `CommandSpec` (1919, `argumentHint`), `RegisteredToolSpec` (9719), `ToolCallResult` (`{ result }` or `{ deny }`, the model receives `deny` as an error result), `AbovePrompt` props (10666-10777: `hasSurvey`, `bodyColumns`, terminal and desktop only), `RenderResultOf` (10784: `next(e)` resolves to the next tree), `$.ui.open`/`$.ui.close` (2512-2547).
- Evidence in existing code: `session-info/hooks/todos.ts:19` (`TODO_SPEC`, a registered tool spec), `session-info/hooks/register.tsx:1019-1027` (registrations in `session.start`), `:1159-1196` (reload after `/clear` and `/resume`), `:500` (`afterSwitch`), `:1253-1262` (a tool answered by its own `tool.call` hook, `deny` on invalid input, subagent calls ignored), `session-info/hooks/viewer.ts` (`editor` logic), `session-info/hooks/paths.ts` (`norm`, `absolute`), `session-info/hooks/host.ts` (the `Host` boundary).
- Memory of measured host behavior (2026-10-13, Claude Code 2.1.296): after `/clear` or an in-process `/resume`, `$.state` resets, only `session.end` fires, and `$.session.id()` switches about 900 ms later; the test kit does not reproduce it.
- SDD skills: English variant in `.agents/skills/` (this repository); Portuguese variant in `D:\Projetos\agents-instructions\SKILLS\` (separate repository).

## Solution summary

A new mod, `feature-progress`, registers one tool, `report`, which the engine exposes as `mcp__feature-progress__report`. The tool's own `tool.call` hook validates the input, reads the stored feature file, merges the report into it, stamps the timestamps, writes the file back and updates `$.state`; the band and the pane draw from `$.state` only. The mod reads the storage folder at `session.start`, after a `/clear` or `/resume` switch, and on Refresh; it never polls the disk. Pure helpers own parsing, merging, derived values (stage text, `n/m`, stale, group order) and storage paths; `register.tsx` owns the hooks and the engine calls; `.tsx` modules draw.

Both SDD skill variants get one new reference file that defines the report protocol once (availability, call points, state mapping); each skill links to it from the lines where its states change. The English variant ships in this repository with the mod; the Portuguese variant ships in its own repository and branch.

## Technical decisions

| ID | PRD obligations | Decision | Reason and evidence | Alternatives and trade-offs |
| --- | --- | --- | --- | --- |
| DEC-01 | FR-07, NFR-01 | The mod writes only `<id>.json` files in the configured folder (default `.claude/feature-progress/`) under the session's working directory, and deletes only `<id>.json` files of `done` features there. This is a documented exception to `mod-runtime.md` ("writes files only … under the temporary directory", "never edits a file of the repository"); the same change adds the exception to that rule's Files section. | User decision at this TechSpec's HIL (2026-10-25), keeping the PRD's persistence choice. | Temp folder per repository (follows the rule, but leaves the repo and can be cleaned by the system); temp default with an opt-in repo folder. |
| DEC-02 | FR-01, FR-04, FR-05, FR-08 | Invalid input answers `{ deny: 'feature-progress: <reason>' }`; a valid call answers `{ result: 'feature-progress: <stage> · <n>/<m>' }`; a call from a subagent (`e.agentId !== undefined`) answers `{ result: 'Ignored: only the main session reports progress.' }` and writes nothing. | `ToolCallResult`: the model receives `deny` text as an error result; the same shape as `session-info/hooks/register.tsx:1253-1262`. | Throwing in the hook (the call would be skipped with no reason for the model). |
| DEC-03 | FR-02, FR-16, NFR-02 | Every report reads the target file, merges, writes, then sets `$.state` and invalidates the render. A missing file means a new feature. | Reading the one target file is allowed by NFR-02; it keeps a report from dropping tasks another session wrote since the last Refresh. Last-write-wins shrinks to two writes at the same moment. | Merge into `$.state` only (cheaper, but overwrites changes from another session). |
| DEC-04 | FR-07, FR-17 | A feature `id` matches `^[a-z0-9][a-z0-9-]{0,63}$`; the file name is `<id>.json`. A task `id` is a non-empty string of at most 64 characters with no control character. | Lower case avoids collisions on case-insensitive file systems; the id is the only text that reaches a command line (DEC-05). `02-feature-progress` and `T08` both fit. | Free ids with an encoded file name (harder to read on disk, and DEC-05 would need escaping). |
| DEC-05 | FR-17, NFR-07 | The clean command deletes through `$.process.run` with `cwd` set to the absolute storage folder and one file name per argument: `['rm', '-f', '--', '<id>.json', …]` on macOS and Linux, `['cmd', '/d', '/c', 'del', '/f', '/q', '<id>.json', …]` on Windows. The folder never appears in argv. This is the prior justification for the `cmd /c` hit of QA-04. | `$.fs` has no delete (`index.d.ts:3298-3425`); `mod-runtime.md` allows a changing command when the feature's job is to change something and the README says so. The DEC-04 regex leaves no character that `cmd` parses. | PowerShell `-Command` (joins arguments into one command string, unsafe); leaving files and hiding them (PRD asks to delete). |
| DEC-06 | FR-10 | The band composes with the chain: on `hasSurvey` it returns `next(e)`; otherwise it draws its one line above the tree that `await next(e)` resolves to. | `RenderResultOf` (`index.d.ts:10784`): `next(e)` resolves to the next hook's tree. A mod that draws `AbovePrompt` without calling `next` (savvy-progress, `register.tsx:1025-1027`) can still hide this band by load order; the README states it. | Returning only this band (hides the other mods' bands). |
| DEC-07 | FR-06, FR-14 | Helpers take `now` (epoch milliseconds) as an argument; `register.tsx` reads it from `$.clock.now()`. Stored timestamps are ISO 8601 strings. Any change to a task or to the feature sets the feature's `updatedAt`. | Reservation rule "clock in a helper"; FR-09 and FR-14 depend on the feature's `updatedAt` moving with its tasks. | Epoch numbers on disk (less readable for other flows). |
| DEC-08 | FR-15 | `hooks/viewer.ts` is a reduced copy of the `editor` part of `session-info/hooks/viewer.ts` (`auto`, `vscode`, `system`), not an import. | Each mod installs alone (AGENTS.md: one top-level folder per mod); an import across mods breaks a standalone install. | Shared package (the repository has no package system). |
| DEC-09 | FR-16, OBJ-03 | Reload in `session.end` with reason `clear` or `resume`, after `$.session.id()` differs from `e.sessionId` (same pattern as `afterSwitch`), then `$.ui.invalidate('ui.render')`. | Measured host behavior: `session.start` does not fire after `/clear` and `/resume`, and `$.state` starts empty. | Reload on the first render (a render may not write `$.state`). |
| DEC-10 | FR-14 | One `$.clock.every(60_000)` timer, started in `session.start`, invalidates the render only when a not-done feature exists. It never reads the disk. | NFR-02; "updated X ago" has minute precision. | A timer per feature; a 1 s timer. |
| DEC-11 | FR-19, FR-20 | One reference file per variant defines the protocol: `.agents/skills/sdd-orchestrate-tasks/references/progress-report.md` (English) and `SKILLS/sdd-orquestrar-tasks/references/relatorio-progresso.md` (Portuguese). Each skill links to it at its transition lines. | All 6 skills already read `session-continuity.md` / `continuidade-sessao.md` in that folder; the `.claude/skills` links cover the folder. | The same text inline in every SKILL.md (6 copies per variant to keep in sync). |
| DEC-12 | FR-19, FR-20 | The Portuguese variant has no QA stage; its mapping has no `qa` row. Its phases and statuses are in Portuguese and map as in the Contracts section. | Explorer report: no QA skill or `qa_NN` folder in `SKILLS/` (`bundles.yaml:58-74`, `sdd-orquestrar-fluxo/SKILL.md:45-57`); phases at `estado-hil.md:14-15`. | — |
| DEC-13 | FR-22 | `userConfig` `showBand` (boolean, default `true`) is read once per load in `settingsOf`. With `false`, the `AbovePrompt` hook returns `next(e)` at once. `/feature-progress band` calls `$.config.set({ key: 'feature-progress.showBand', value: !settings.showBand })`; the engine then loads the module again with the new value. A `{ deny }` answers the command with the reason and leaves the value. | `index.d.ts:9706` (a change to the options reloads the plugin and `register` runs again); `$.config.set` changes a row as `/config` does (`index.d.ts:3194-3205`); the same pattern as `session-info/hooks/register.tsx:1755` and `topic-guard/hooks/register.tsx:243`. The value lives in the settings, so it survives `/clear`, `/resume` and new sessions. | A `$.state` flag (lost on `/clear`, DEC-09); a separate file in the storage folder (a second persisted format). |
| DEC-14 | FR-23, NFR-04, NFR-05 | `paneBackground` (string, default empty) and `icons` (`unicode` \| `nerd` \| `emoji`, default `unicode`) are read once per load in `settingsOf`. The `Pane` hook paints its root `Box` with `backgroundColor` and `minHeight: e.props.scroll.bodyRows` on the terminal only, as session-info does. `KIND_STYLE` holds one glyph per icon set and a theme color per kind; the band and the pane take them through `styleOf`. The stage is a `Text` chip (`backgroundColor` = state color, `color: inverseText`); meters are `━`/`─` text runs (`meter.tsx`). Feature cards have a round border that lights in the state color on hover, dropped below 44 columns; task details go on the title row from 64 columns. The band drops the meter before it shortens the title below 12 columns. | `pane-ui.md` (theme colors only, `paneBackground` the one hex value, `icons` opt-in, frames below 44 columns); `session-info/hooks/register.tsx:2678`, `session-info/hooks/cards.tsx:37`, `session-info/hooks/icons.ts`. | A `Box` bar with `backgroundColor` (no `Box` inside a `Button`, which holds only `Text`); hex colors per state (against `pane-ui.md`); painting the band (session-info does not). |

## Components and flow

| ID | Component | New or modified | Responsibility | Dependencies |
| --- | --- | --- | --- | --- |
| CMP-01 | `feature-progress/.claude-plugin/plugin.json` | New | Manifest: name, version `0.1.0`, description, author, homepage, license, `types`, `userConfig` (`folder`, `staleMinutes`, `editor`, `showBand`). | — |
| CMP-02 | `feature-progress/hooks/hooks.json`, `feature-progress/tsconfig.json` | New | Name `./register.tsx`; extend `./.claude-plugin/types/tsconfig.json`. | — |
| CMP-03 | `feature-progress/hooks/report.ts` | New | `KINDS` literal union; `parseReport(input): Report \| string` (narrowing of `unknown`, DEC-04 ids, FR-04 titles, FR-05 kinds, `steps` with `0 ≤ done ≤ total`, `round` positive integer); `applyReport(stored, report, now): Feature \| string` (FR-02, FR-03, FR-06, DEC-07). | — |
| CMP-04 | `feature-progress/hooks/progress.ts` | New | Derived values: `stageText` (`label` or kind, `#round`), `countOf` (FR-13), `isStale(feature, now, minutes)` (FR-14, not `done`, not `waiting`), `latestOpen`, `orderFeatures`, `groupTasks` (FR-12 order), `agoText`, `durationText`, `replyText` (FR-08). | CMP-03 |
| CMP-05 | `feature-progress/hooks/store.ts` | New | `fileName(id)`, `folderOf(cwd, option)` (absolute, normalized), `parseFeature(text): Feature \| undefined` (FR-18), `serialize` with the 4 MiB guard (NFR-03), `loadAll(host, folder)`, `readOne`, `writeOne`, `cleanArgv(platform, names)` (DEC-05). Uses the `Host`. | CMP-03, CMP-06, CMP-07 |
| CMP-06 | `feature-progress/hooks/host.ts` | New | `Host` type: `readFile`, `writeFile`, `list`, `run(argv, cwd)`, `env`, `cwd`, `toast`. Built from `$` in `register.tsx`. | — |
| CMP-07 | `feature-progress/hooks/paths.ts` | New | `norm`, `join`, `absolute` (both separators, drive letters, spaces). | — |
| CMP-08 | `feature-progress/hooks/viewer.ts` | New | `openLink(host, editor, cwd, path)` with `auto | vscode | system` (DEC-08); missing file → toast. | CMP-06, CMP-07 |
| CMP-09 | `feature-progress/hooks/spec.ts` | New | `REPORT_NAME = 'report'`, `REPORT_TOOL = 'mcp__feature-progress__report'`, `REPORT_SPEC` (description and `inputSchema`, `isDeferred: false`). | CMP-03 |
| CMP-10 | `feature-progress/hooks/icons.ts` | New | `KIND_STYLE`: glyph, word and theme color per kind, `satisfies Record<Kind, …>` (NFR-04). | CMP-03 |
| CMP-11 | `feature-progress/hooks/band.tsx`, `feature-progress/hooks/pane.tsx` | New | Draw the band line (FR-09, NFR-05) and the pane (FR-11, FR-12, FR-15, FR-18, empty state) from plain values and callbacks. | CMP-04, CMP-10 |
| CMP-12 | `feature-progress/hooks/register.tsx` | New | Hooks: `session.start` (register tool, command, timer; load), `session.end` (DEC-09), `tool.call` on `REPORT_TOOL`, `command.run` on `feature-progress`, `ui.render` on `AbovePrompt` and on `Pane` `feature-progress`. Builds the `Host`; reads `options` once. | CMP-03 … CMP-11, CMP-13 |
| CMP-13 | `feature-progress/types/index.d.ts` | New | `$.state` keys under `feature-progress` (Contracts). | CMP-03 |
| CMP-14 | `feature-progress/tests/*.test.ts` | New | Unit tests for CMP-03 … CMP-08; kit tests for CMP-12 (Test approach). | all |
| CMP-15 | `feature-progress/README.md` | New | Sections, options, the contract for other flows with 2 examples (FR-21), the `.gitignore` recommendation, the delete command (DEC-05), limitations (DEC-06, no live updates, tested version), Install section. | — |
| CMP-16 | `.claude-plugin/marketplace.json`, `README.md` (root) | Modified | Register the mod; add its Mods table row. | CMP-01 |
| CMP-17 | `.agents/rules/mod-runtime.md` | Modified | Add the DEC-01 exception to the Files section. | DEC-01 |
| CMP-18 | `.agents/skills/sdd-orchestrate-tasks/references/progress-report.md` and links in `sdd-orchestrate-flow/SKILL.md`, `sdd-orchestrate-flow/references/hil-state.md`, `sdd-plan-tasks/SKILL.md`, `sdd-orchestrate-tasks/SKILL.md`, `sdd-execute-task/SKILL.md`, `sdd-plan-corrections/SKILL.md`, `sdd-execute-corrections/SKILL.md`, `sdd-review-code/references/delegated-review.md` | New and modified | English protocol and call points (FR-19, FR-20). | DEC-11 |
| CMP-19 | `SKILLS/sdd-orquestrar-tasks/references/relatorio-progresso.md` and links in `sdd-orquestrar-fluxo/SKILL.md`, `sdd-orquestrar-fluxo/references/estado-hil.md`, `sdd-planejar-tasks/SKILL.md`, `sdd-orquestrar-tasks/SKILL.md`, `sdd-executar-task/SKILL.md`, `sdd-planejar-correcoes/SKILL.md`, `sdd-executar-correcoes/SKILL.md`, `sdd-revisar-codigo/references/revisao-delegada.md` (in `D:\Projetos\agents-instructions`) | New and modified | Portuguese protocol and call points, written in Portuguese (DEC-12). | DEC-11, DEC-12 |

**Report flow.** The model calls `mcp__feature-progress__report` → the `tool.call` hook (CMP-12) ignores a subagent call → `parseReport` (CMP-03) or `deny` → `readOne` (CMP-05) of `<folder>/<id>.json` (missing → new; unreadable → `deny`, FR-18) → `applyReport` with `now` from `$.clock.now()` → `serialize` (size guard) → `writeOne` → `$.state` features updated, the file's warning cleared → `$.ui.invalidate('ui.render')` → `{ result: replyText }`.

**Load flow.** `session.start`, the post-switch reload (DEC-09) and the Refresh button call `loadAll` → features and warnings in `$.state` → invalidate.

**Draw flow.** `AbovePrompt` reads `$.state`, picks `latestOpen`, and draws one line above `next(e)` (DEC-06); pressing it opens the pane. The `Pane` draws the header with Refresh, the open features (latest expanded), the collapsed Done section and the warning rows.

**Command flow.** `/feature-progress` toggles the pane (`$.ui.open` / `$.ui.close`, open state from `$.ui.panes()`); the band press only opens or focuses it (codereview_01/CR-02); `/feature-progress clean` takes the `done` features from `$.state`, runs `cleanArgv` in the folder, reloads, and toasts the count.

## Contracts and data

### Tool `mcp__feature-progress__report`

Input (`inputSchema`, JSON Schema):

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `feature.id` | string | yes | DEC-04 regex |
| `feature.title` | string | on create | non-empty after trim |
| `feature.state` | kind | no | one of the 9 kinds; default `pending` on create |
| `feature.label` | string | no | shown instead of the kind word in the band and the feature chip |
| `feature.round` | integer | no | ≥ 1; `null` clears it |
| `feature.note` | string | no | `""` clears it |
| `tasks[]` | array | no | each item as below |
| `tasks[].id` | string | yes | 1-64 characters, no control character |
| `tasks[].title` | string | on create | non-empty after trim |
| `tasks[].state`, `.label`, `.round`, `.note` | as feature | no | same rules, except that a task `label` shows next to the kind word (`kindText`, codereview_01/CR-03) |
| `tasks[].group` | string | no | `""` clears it |
| `tasks[].steps` | `{ done, total }` integers | no | `0 ≤ done ≤ total`, `total ≥ 1`; `null` clears it |
| `tasks[].link` | string | no | path, relative to the session's working directory or absolute; `""` clears it |
| `remove` | string[] | no | task ids; unknown ids ignored |

Kinds: `pending`, `planning`, `active`, `review`, `fixing`, `qa`, `waiting`, `blocked`, `done`. A task `id` that appears twice in one call is refused.

Tool description (exact text, asserted by TC-05):

> Report the progress of a feature and its tasks to the feature-progress band and pane. Only the main session calls this tool; subagents do not. Each call merges into the stored feature: send `feature.id` always, `feature.title` on the first call, and only the fields and tasks that changed. A task is matched by `id`; a new id adds it, a known id updates only the fields sent. `remove` deletes tasks by id. `state` is one of: pending, planning, active, review, fixing, qa, waiting, blocked, done. Use `round` for the review, correction or QA round, `group` to group tasks such as "Review #1", `steps` for done/total sub-steps, `note` for a short reason, and `link` for a file path. The tool sets the timestamps.

### Stored file `<folder>/<id>.json`

```json
{
  "schemaVersion": 1,
  "id": "02-feature-progress",
  "title": "feature-progress",
  "state": "fixing",
  "round": 1,
  "startedAt": "2026-10-25T10:00:00.000Z",
  "updatedAt": "2026-10-25T12:30:00.000Z",
  "tasks": [
    { "id": "T01", "title": "Add the report helper", "state": "done", "startedAt": "…", "updatedAt": "…", "finishedAt": "…" },
    { "id": "T08", "title": "Fix CR-01", "state": "active", "group": "Review #1", "steps": { "done": 1, "total": 3 }, "link": "tasks/prd-02-feature-progress/codereview_01/task_08.md", "updatedAt": "…" }
  ]
}
```

A file with another `schemaVersion`, broken JSON, or a missing `id`, `title`, `state` or `tasks` counts as unreadable (FR-18). Optional fields absent from the file are omitted, not `null`.

### `userConfig`

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `folder` | string | `.claude/feature-progress/` | Folder for the feature files, relative to the session's working directory or absolute. Empty falls back to the default. |
| `staleMinutes` | number | `30` | Minutes without a report before an active feature shows the stale marker. `0` turns the marker off. |
| `editor` | string, options `auto`, `vscode`, `system` | `auto` | Program that opens a task's link. |
| `showBand` | boolean | `true` | Shows the band above the prompt. `false` hides it; the pane and the reports still work. `/feature-progress band` flips it (DEC-13). |
| `paneBackground` | string | `""` | A color for the pane body in the terminal, hex or name; empty keeps Claude Code's color; the desktop app ignores it (DEC-14). |
| `icons` | `unicode` \| `nerd` \| `emoji` | `unicode` | The state glyphs; `nerd` needs a Nerd Font, `emoji` a terminal that draws emoji 2 cells wide (DEC-14). |

The code defaults live in one constant each, next to the manifest default (code-standards.md "Named values").

### `$.state` (`types/index.d.ts`, under `feature-progress`)

- `features: Record<string, Feature>` — loaded and reported features by id.
- `warnings: string[]` — paths of unreadable files.
- `toggled: string[]` — feature ids, and `done` for the Done section, whose expanded or collapsed state the person flipped in the pane. Whether the pane is open comes from `$.ui.panes()`, the engine's own answer, so it cannot drift after `/clear` resets `$.state` (DEC-09), so `$.state` keeps no open flag (AUTO-08, codereview_01/CR-06).

No `$.store` keys.

### Command

`$.command.register({ name: 'feature-progress', description: 'Open or close the feature-progress pane; band shows or hides the band; clean deletes the files of done features.', argumentHint: '[band|clean]' })`. `band` flips `showBand` (DEC-13) and answers `Feature progress band hidden.` or `Feature progress band shown.`; a `{ deny }` from `$.config.set` answers `feature-progress: <deny>`. Any other argument answers `{ text }` with the usage line.

### SDD state mapping (both reference files)

| Source | English variant | Portuguese variant | Report |
| --- | --- | --- | --- |
| Checkpoint phase | `product`, `plan-project` | `produto`, `projeto-plano` | feature `planning` |
| | `implementation` | `implementacao` | feature `active` |
| | `review` | `revisao` | feature `review`, `round` = NN of `codereview_NN` |
| | `corrections` | `correcoes` | feature `fixing`, `round` = NN of the review being corrected |
| | `qa` | — | feature `qa`, `round` = NN of `qa_NN` |
| | `acceptance` | `aceite` | feature `waiting` |
| | `completed` | `concluido` | feature `done` |
| Checkpoint status | `awaiting-hil` | `aguardando-hil` | feature `waiting` |
| | `blocked` | `bloqueado` | feature `blocked` |
| Task manifest | selected, completed, block, reopened | selecionada, concluída, bloqueio, reaberta | task `active`, `done`, `blocked`, `pending` |
| Subtask checkbox | ticked with evidence | marcada com evidência | task `steps` |
| Correction task | created in `codereview_NN/` or `qa_NN/` | criada em `codereview_NN/` | task with `group` "Review #N" or "QA #N", `link` to its file |

The feature `id` is the slug of `tasks/prd-<slug>/`; the title comes from the PRD heading.

## Integrations and interfaces

| Hook or call | Type | Input → output | Failure choice |
| --- | --- | --- | --- |
| `session.start` | observer | registers the tool, the command and the timer, then `loadAll`; ends with `next(e)` | `.catch(($, e, next) => next(e))`; a failed registration toasts `feature-progress: …`. Safe to repeat on reload. |
| `session.end` (`clear`, `resume`) | observer | DEC-09 reload | `.catch` → `next(e)` |
| `tool.call` on `REPORT_TOOL` | gating | DEC-02 | `.catch` answers `{ deny: 'feature-progress: could not save the report: <error>' }`; the person and the model learn the report failed. |
| `command.run` on `feature-progress` | gating | toggle or clean, answers `{ text }` | `.catch` answers `{ text: 'feature-progress: <error>' }`. |
| `ui.render` `AbovePrompt` | draw | DEC-06 | no `.catch`: a failed draw is skipped and the chain draws without the band. |
| `ui.render` `Pane` (`requestId: 'feature-progress'`) | draw | pane tree | no `.catch`: the engine draws its fallback. |
| `$.fs.read` / `write` / `list` | through `Host` | missing file → new feature; missing folder → no features | errors from `write` reach the `tool.call` catch. |
| `$.process.run` | through `Host` | DEC-05 argv, `cwd` = folder | non-zero exit → toast with the count deleted and the failure; reload shows what is left. |
| `$.clock.every(60_000)` | timer | invalidate | handle kept; restarted only by a reload. |

## Errors, security, and recovery

- Errors and edges: invalid input → `deny` naming the field; unreadable stored file → warning row and `deny` on report, file untouched (FR-18); report over 4 MiB → `deny`, nothing written (NFR-03); a link to a missing file → toast naming the path; storage folder missing → empty state; `staleMinutes: 0` → no marker; a pane on a terminal too narrow → `$.ui.open` reports not drawn → toast `feature-progress: widen the terminal to open the pane.`.
- User files and sensitive data: writes and deletes stay inside the configured folder and touch only `<id>.json` names (DEC-01, DEC-04); the clean command deletes only ids whose stored state is `done`. Text values from the flow are shown in the pane only, never in toasts or logs (code-standards.md).
- Concurrency and idempotency: one writer per session (subagents ignored); read-merge-write per report (DEC-03); a repeated identical report changes only `updatedAt`. Registrations repeat safely on reload.
- Rollback or reversal: uninstall the mod; the skills skip the step when the tool is absent (NFR-08). The stored files are plain JSON the person can delete. Revert the skill changes by reverting their commits in each repository.

## Sequencing

| Step | Depends on | Verifiable result |
| --- | --- | --- |
| 1. Scaffold: manifest, `hooks.json`, `tsconfig.json`, `types/index.d.ts`, `host.ts`, `paths.ts` | — | `claude plugin validate feature-progress` passes; the types are laid |
| 2. `report.ts` with parse, merge, remove, timestamps | 1 | TC-01 … TC-04 pass |
| 3. `progress.ts` and `icons.ts` | 2 | TC-06 … TC-08 pass |
| 4. `store.ts` with load, write, size guard, clean argv | 2 | TC-09 … TC-11 pass |
| 5. `spec.ts` and the `tool.call` / `session.start` / `session.end` hooks | 2, 4 | TC-05, TC-12, TC-13 pass |
| 6. Band, pane, command, link (`band.tsx`, `pane.tsx`, `viewer.ts`) | 3, 5 | TC-14 … TC-19 pass on terminal and desktop |
| 7. README, marketplace, root README, `mod-runtime.md` exception | 6 | `claude plugin validate .` passes; FR-21 review |
| 8. English skill protocol and links | 5 | TC-20 |
| 9. Portuguese skill protocol and links, on branch `feat/relatorio-progresso` in `D:\Projetos\agents-instructions` | 8 | TC-21 |
| 10. Manual acceptance in a real session | 7, 8 | TC-22 … TC-25, TC-27 |
| 11. Option to hide the band (`showBand`, `/feature-progress band`) and its README rows | 6, 7 | TC-26 |
| 12. Modern drawing, `paneBackground` and `icons`, README rows | 11 | TC-28 |

## Test approach

- Profile: surfaces `terminal` and `desktop` (the only ones that raise `AbovePrompt` and `Pane`); Claude Code 2.1.310 locally (session-info's badge says 2.1.296; the new README states the version used in TC-22); `tsconfig.json` extends the engine's; kit `claude-code/testing`; commands, one at a time: `claude plugin validate .`, `claude plugin validate feature-progress`, `claude plugin test feature-progress`, `tsc -p feature-progress` (TypeScript 7.0.2 installed; needs one load first).
- Real session: add the clone as a folder marketplace, install `feature-progress` with `--scope user` to try it outside this repository, `/reload-plugins` after an edit.
- Platforms: Windows (local, manual); macOS and Linux: the clean argv and the `editor` argv are covered by unit tests on the platform branch; real runs there stay unverified and the README says so.
- Command prerequisites and exclusions: the kit has no file system or process; use a fake `Host` that records `writeFile` and `run` calls, `mock.clock(on)` for the timer.
- Manual acceptance: the user runs TC-22 … TC-25 and TC-27.

| ID | Obligations | Level | Scenario | Expected result | Command or suite |
| --- | --- | --- | --- | --- | --- |
| TC-01 | FR-01, FR-04, FR-05, DEC-04 | unit | parse valid input; missing `feature.id`; bad id; unknown kind; `steps.done > total`; duplicate task id; non-object input | `Report` or a message naming the field; the kind message lists the 9 kinds | `tests/report.test.ts` |
| TC-02 | FR-02, FR-04 | unit | create feature with tasks; second call with one task's `state` only; new task without title | fields kept; order kept; missing title refused | `tests/report.test.ts` |
| TC-03 | FR-03 | unit | `remove` known and unknown ids | known removed; unknown ignored | `tests/report.test.ts` |
| TC-04 | FR-06, DEC-07 | unit | `pending → active → done → fixing` with injected `now`; a task change | `startedAt` once, `finishedAt` set then cleared, feature `updatedAt` moves with the task | `tests/report.test.ts` |
| TC-05 | FR-01, FR-08, DEC-02 | kit | tool registered on `session.start`; exact description text; valid call; invalid call; subagent call | spec equals `REPORT_SPEC`; `{ result }` with `stage · n/m`; `{ deny }`; `Ignored` and no write | `tests/register.test.ts` |
| TC-06 | FR-13, FR-08 | unit | 10 done + 7 corrections, 2 done | `12/17`; reply text | `tests/progress.test.ts` |
| TC-07 | FR-14 | unit | stale limit, `waiting`, `done`, `staleMinutes: 0` | marker only for the not-done, not-waiting feature past the limit | `tests/progress.test.ts` |
| TC-08 | FR-09, FR-11, FR-12 | unit | 2 open + 1 done; ungrouped and grouped tasks | latest open first; ungrouped then groups in first-seen order | `tests/progress.test.ts` |
| TC-09 | FR-07, FR-18 | unit | `loadAll` with valid, broken JSON, wrong schema, missing folder | features plus warning paths; empty on missing folder | `tests/store.test.ts` |
| TC-10 | NFR-03 | unit | serialized size above 4 MiB | refused, no `writeFile` call | `tests/store.test.ts` |
| TC-11 | FR-17, DEC-05, NFR-07 | unit | `cleanArgv` on windows and posix; folder with spaces | argv as DEC-05, folder only in `cwd` | `tests/store.test.ts` |
| TC-12 | FR-02, DEC-03, FR-18 | kit | report when the file changed on disk; report for an unreadable file | merged with the disk version; `deny` and no write | `tests/register.test.ts` |
| TC-13 | FR-16 | kit | `session.start` loads; no read without a report or Refresh across timer ticks | one `list` at start; zero reads on ticks | `tests/register.test.ts` |
| TC-14 | FR-09, DEC-06, NFR-05 | kit, both surfaces | band with 2 open features; no open feature; `hasSurvey`; narrow `bodyColumns` | latest feature line above `next(e)`; nothing added; `next(e)` alone; title shortened first | `tests/band.test.ts` |
| TC-15 | FR-10 | kit | press the band; run `/feature-progress` twice | pane opens; second run closes it | `tests/register.test.ts` |
| TC-16 | FR-11, FR-12, NFR-04 | kit, both surfaces | pane with groups, steps, notes, done section, warning row, empty state | rows show glyph and word, `#round`, `2/5` bar, note line, collapsed Done, empty-state text | `tests/pane.test.ts` |
| TC-17 | FR-14 | kit | `mock.clock` past the limit | stale marker in band and pane | `tests/band.test.ts` |
| TC-18 | FR-15 | unit + kit | `editor` auto with and without `code`, `system` per platform; missing file | argv per case; toast with the path | `tests/viewer.test.ts` |
| TC-19 | FR-17 | kit | `/feature-progress clean` with 2 done and 1 active; failing `run` | `run` argv with 2 names; toast `Deleted 2 done features`; failure toast | `tests/register.test.ts` |
| TC-20 | FR-19, FR-20, NFR-08 | review | English reference file and links at every transition line listed in CMP-18 | every call point present; the step says to skip when the tool is absent | `rg -n "progress-report.md" .agents/skills` |
| TC-21 | FR-19, FR-20, NFR-08, DEC-12 | review | Portuguese reference file and links listed in CMP-19 | same, no `qa` row | `rg -n "relatorio-progresso.md" SKILLS` |
| TC-22 | OBJ-01, FR-20 | manual | run `sdd-orchestrate-flow` on a small feature with one review round | band and pane follow planning → active → review #1 → fixing #1 → review #2 → waiting → done | real session |
| TC-23 | OBJ-03, DEC-09 | manual | `/clear` and `/resume` after reports | band and pane come back without a new report | real session |
| TC-24 | US-06, FR-16 | manual | two sessions on one repository; report in one; Refresh in the other | the other shows the change only after Refresh | real session |
| TC-25 | NFR-08, OBJ-04 | manual | run a skill with the mod disabled | the skill completes with no error and no extra question | real session |
| TC-26 | FR-22, DEC-13 | unit + kit | `settingsOf` default and `false`; band with `showBand: false` and an open feature; `/feature-progress band` with each value; a `config.set` hook that denies | default `true`; `next(e)` alone; `config.set` with key `feature-progress.showBand` and the flipped value, confirmation text; the deny reason in the text | `tests/settings.test.ts`, `tests/band.test.ts`, `tests/register.test.ts` |
| TC-27 | FR-22 | manual | with an open feature, run `/feature-progress band` twice; `/clear` between | band hides, stays hidden after `/clear`, comes back; `/config` shows the value; the pane opens while hidden | real session |
| TC-28 | FR-23, DEC-14 | unit + kit | `settingsOf` with and without `paneBackground` and `icons`; pane on terminal and desktop with a background; band with `icons: emoji`; band at 30 columns; pane at 40 columns; `filledCells`, `percentText` | trimmed value or `''`, `unicode` fallback; root `Box` painted on terminal only; the emoji glyph; no meter and a shortened title; details under the title; the meter share and percent | `tests/settings.test.ts`, `tests/pane.test.ts`, `tests/band.test.ts`, `tests/progress.test.ts` |

## Quality profile

Rules this feature can violate. A blocking hit prevents task completion and rejects the review; a reservation becomes an optional improvement and counts toward escalation. A hit covered by `DEC-NN` is expected, not a finding.

| ID | Rule | Class | Verification command | Prior justification |
| --- | --- | --- | --- | --- |
| QA-01 | `any` in any form | blocking | `"${RG[@]}" ':\s*any\b\|\bas any\b\|<any>' "${files[@]}"` | — |
| QA-02 | `@ts-ignore`, `@ts-nocheck`, `eslint-disable` | blocking | `"${RG[@]}" '@ts-ignore\|@ts-nocheck\|eslint-disable' "${files[@]}"` | — |
| QA-03 | empty `catch` on a call the person waits for | blocking | `"${RG[@]}" -U 'catch\s*(\([^)]*\))?\s*\{\s*\}\|\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)' "${files[@]}"` | — |
| QA-04 | shell command string or shell with input-built text | blocking | `"${RG[@]}" "'cmd', '/c'\|'cmd', '/d', '/c'\|'(sh\|bash)', '-c'\|shell:\s*true" "${files[@]}"` | DEC-05 (the `del` argv in `store.ts`), and the `viewer.ts` launcher shape copied from session-info (DEC-08) |
| QA-05 | `$` or a `'claude-code'` value in a helper | blocking | `"${RG[@]}" '^(?!\s*(/?\*\|//)).*(from .claude-code.\|\$\.(fs\|process\|ui\|store\|session\|clock\|env\|prompt\|mcp)\.)' --pcre2 "${helper_files[@]}"` | — |
| QA-06 | `node:*`, `require`, `import()`, `setTimeout`, `setInterval` | blocking | `"${RG[@]}" "from 'node:\|require\(\|\bimport\(\|\bsetTimeout\|\bsetInterval" "${mod_files[@]}"` | — |
| QA-07 | `console.*` | blocking | `"${RG[@]}" 'console\.' "${mod_files[@]}"` | — |
| QA-08 | `throw new Error(` in a hook path | reservation | `"${RG[@]}" 'throw new Error\(' "${files[@]}"` | — |
| QA-09 | clock or randomness in a helper | reservation | `"${RG[@]}" 'Date\.now\(\)\|new Date\(\)\|Math\.random\(\)' "${helper_files[@]}"` | — (`new Date(ms)` for ISO text is allowed: it reads no clock) |
| QA-10 | 4+ parameters in one declaration | reservation | `"${RG[@]}" '\((?:[^(),]+,){3,}[^()]*\)\s*(?::\s*[^={]+)?\s*(?:\{\|=>)' "${files[@]}"` | — |
| QA-11 | file above 500 lines | reservation | `rg -c -H '^' "${files[@]}" \| awk -F: '$2 > 500'` | — |

- Verification scope: `RG=(rg -n --type ts -g '!node_modules/**' -g '!**/.claude-plugin/types/**')`; `files` = every TypeScript file in the task diff under `feature-progress/`; `helper_files` = `feature-progress/hooks/*.ts` (not `register.tsx`, not `.tsx`); `mod_files` = `feature-progress/hooks/*`.
- Escalation trigger: 8+ reservation hits in the feature, a touched file above 800 lines, or the same block duplicated in 3+ places in the diff.

### Terrain baseline

No TypeScript file that exists today is modified; the TypeScript measures and the greppable set do not apply to the targets below. New files start clean.

| File | Lines | Exported members | Max parameters | Cases | Pre-existing hits | Destination |
| --- | --- | --- | --- | --- | --- | --- |
| `.claude-plugin/marketplace.json` | 27 | n/a | n/a | n/a | — | recorded |
| `README.md` | 107 | n/a | n/a | n/a | — | recorded |
| `.agents/rules/mod-runtime.md` | 40 | n/a | n/a | n/a | — | recorded |
| `.agents/skills/sdd-orchestrate-flow/SKILL.md` | 59 | n/a | n/a | n/a | — | recorded |
| `.agents/skills/sdd-orchestrate-flow/references/hil-state.md` | 68 | n/a | n/a | n/a | — | recorded |
| `.agents/skills/sdd-plan-tasks/SKILL.md` | 23 | n/a | n/a | n/a | — | recorded |
| `.agents/skills/sdd-orchestrate-tasks/SKILL.md` | 38 | n/a | n/a | n/a | — | recorded |
| `.agents/skills/sdd-execute-task/SKILL.md` | 26 | n/a | n/a | n/a | — | recorded |
| `.agents/skills/sdd-plan-corrections/SKILL.md` | 22 | n/a | n/a | n/a | — | recorded |
| `.agents/skills/sdd-execute-corrections/SKILL.md` | 29 | n/a | n/a | n/a | — | recorded |
| `.agents/skills/sdd-review-code/references/delegated-review.md` | 65 | n/a | n/a | n/a | — | recorded |
| `SKILLS/sdd-orquestrar-fluxo/SKILL.md` | 57 | n/a | n/a | n/a | — | recorded |
| `SKILLS/sdd-orquestrar-fluxo/references/estado-hil.md` | 67 | n/a | n/a | n/a | — | recorded |
| `SKILLS/sdd-planejar-tasks/SKILL.md` | 23 | n/a | n/a | n/a | — | recorded |
| `SKILLS/sdd-orquestrar-tasks/SKILL.md` | 38 | n/a | n/a | n/a | — | recorded |
| `SKILLS/sdd-executar-task/SKILL.md` | 26 | n/a | n/a | n/a | — | recorded |
| `SKILLS/sdd-planejar-correcoes/SKILL.md` | 22 | n/a | n/a | n/a | — | recorded |
| `SKILLS/sdd-executar-correcoes/SKILL.md` | 29 | n/a | n/a | n/a | — | recorded |
| `SKILLS/sdd-revisar-codigo/references/revisao-delegada.md` | 55 | n/a | n/a | n/a | — | recorded |

- Preparatory refactoring: not recommended. No target crosses a structural threshold; the skill files take one short link each at their transition lines.

## Observability and rollout

- Signals: the tool's `result` / `deny` text; toasts for clean, link and registration failures; warning rows for unreadable files. No logs.
- Migration and compatibility: `schemaVersion: 1` in every file; a later version reads older files or treats them as unreadable with a warning.
- Rollout and rollback:
  1. This repository: one feature branch with the mod, the marketplace and README rows, the `mod-runtime.md` exception and the English skill changes; `version` `0.1.0`.
  2. `D:\Projetos\agents-instructions`: branch `feat/relatorio-progresso` from `master`, Portuguese text and commit subjects, a PR; projects receive it only after merge, push and `Update-AllSkills.ps1`.
  3. Rollback: uninstall the mod or revert the commits; the skills keep working without the tool.

## Risks and open items

- Risk: another mod draws `AbovePrompt` without calling `next` (savvy-progress does), so the band is hidden when that mod runs first. Probability medium for the user (savvy-progress is installed), impact low (the pane still works). Mitigation: DEC-06 and a README limitation.
- Risk: the model skips a report step, so the band is stale. Probability medium, impact low. Mitigation: the stale marker (FR-14) and short, explicit call points in the skills.
- Risk: two sessions write the same feature at the same moment and one report is lost. Probability low, impact low. Mitigation: DEC-03; the next report repairs the state.
- Risk: the `/clear` reload depends on measured, not declared, timing (DEC-09). Mitigation: same bounded polling as session-info; TC-23 manual.
- Resolved (2026-10-25, user authorized): the PRD now states that the Portuguese variant has no QA stage (FR-19, FR-20), the concurrency assumption follows DEC-03, and the Constraints list the `mod-runtime.md` exception (DEC-01).

## Relevant files

- Create: `feature-progress/.claude-plugin/plugin.json`, `feature-progress/hooks/hooks.json`, `feature-progress/tsconfig.json`, `feature-progress/types/index.d.ts`, `feature-progress/hooks/{register.tsx,report.ts,progress.ts,store.ts,host.ts,paths.ts,viewer.ts,spec.ts,icons.ts,band.tsx,pane.tsx}`, `feature-progress/tests/{report,progress,store,viewer,register,band,pane}.test.ts`, `feature-progress/README.md`, `.agents/skills/sdd-orchestrate-tasks/references/progress-report.md`, `D:\Projetos\agents-instructions\SKILLS\sdd-orquestrar-tasks\references\relatorio-progresso.md`
- Modify: `.claude-plugin/marketplace.json`, `README.md`, `.agents/rules/mod-runtime.md`, the English skill files in CMP-18, the Portuguese skill files in CMP-19
