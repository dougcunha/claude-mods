# PRD — feature-progress

## Problem and context

A developer who runs a feature through a spec-driven development (SDD) flow cannot see, at a glance, which tasks of the feature are pending, running or done, or which stage the feature is in (implementation, review round N, corrections round N, QA round N). Today this state is spread over Markdown artifacts and a checkpoint file, and the active task is not recorded on disk at all.

Other developers use other SDD flows, with other skills and other artifact names. A view that parses one flow's artifacts does not work for them. The view must depend on a small, documented contract that any flow can call, not on the files of one flow.

The user's SDD flow already runs in two skill variants (English in this repository, Portuguese in `D:\Projetos\agents-instructions\SKILLS`). Both variants change in the same delivery so that the user's own flow reports its progress from the first release.

## Outcomes and metrics

| ID | Expected outcome | Metric or evidence |
| --- | --- | --- |
| OBJ-01 | The developer sees the stage of the feature and the state of each task without opening any artifact. | During a run of `sdd-orchestrate-flow`, the band and the pane show the feature stage (with its round) and each task's state, and both match the checkpoint and `tasks.md` at every stage change. |
| OBJ-02 | A developer with a different flow integrates without reading the mod's code. | The README alone has the tool name, the input schema, the merge rules, the state list and at least one example call; a flow that follows it gets a correct band and pane. |
| OBJ-03 | The progress survives session boundaries. | After `/clear`, a resumed session or a new session in the same repository, the band and the pane show the last reported state with no new tool call. |
| OBJ-04 | The user's SDD flow reports its progress in both skill variants. | Each skill listed in FR-19, in both variants, has the report step, and a run without the mod installed completes with no error. |

## Stories and journeys

| ID | User | Need | Benefit | Flow or edge |
| --- | --- | --- | --- | --- |
| US-01 | Developer running the SDD flow | See the feature stage and the round (for example "review #2") | Knows where the flow is without reading the checkpoint | The flow reports each stage change; the band updates on the same call |
| US-02 | Developer running the SDD flow | See each task's state and, when reported, its step progress | Knows which task runs now and how far it is | The flow reports `active` with `steps`; the pane shows a small bar |
| US-03 | Developer running the SDD flow | See the correction tasks of a review or QA round as a separate group | Tells planned work apart from corrections | The flow adds tasks with `group: "Review #1"`; the pane groups them |
| US-04 | Developer with another SDD flow | Report progress from their own skills | Gets the same view with no change to their artifacts | They add one tool call per state change, following the README |
| US-05 | Developer who returns after `/clear` or in a new session | See the last known state | Resumes with the context in front of them | The mod reads the stored files at session start |
| US-06 | Developer with two sessions on one repository | See what the other session reported | Follows a parallel feature | They press Refresh in the pane; the mod reads the files again |
| US-07 | Developer whose flow stopped | Notice that an active feature has had no update for a long time | Finds a stalled run | The band and the pane show a stale marker after the limit |
| US-08 | Developer with finished features | Remove the stored files of done features | Keeps the folder clean | They run the clean command; the mod deletes only done features' files |

## Functional requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-01 | The mod registers one tool, `mcp__feature-progress__report`, through the documented tool registration API. The input has a `feature` object (`id` required; `title`, `state`, `label`, `round`, `note` optional), an optional `tasks` array and an optional `remove` array of task ids. | The tool is listed in a session with the mod installed, and its description states the contract of FR-02 to FR-05 without any system-prompt text from the mod. |
| FR-02 | A call merges into the stored feature. Fields that the call omits keep their stored value. A task is matched by `id`; a new `id` adds the task in the order received; a known `id` updates only the fields sent. | Two calls that each send one different task leave both tasks stored; a call that sends only `state` for a task keeps its `title`, `group`, `note` and `link`. |
| FR-03 | `remove` deletes the listed tasks from the feature. An unknown id in `remove` is ignored. | After a call with `remove: ["T03"]`, T03 is not in the file, the band count or the pane. |
| FR-04 | A task has `id` (required) and optional `title`, `state`, `label`, `round`, `group`, `steps` (`done`, `total`), `note` and `link`. A new feature needs `title`; a new task needs `title`. | A call that creates a feature or a task without `title` fails with a message that names the missing field, and nothing is written. |
| FR-05 | `state` of a feature or a task is one of 9 kinds: `pending`, `planning`, `active`, `review`, `fixing`, `qa`, `waiting`, `blocked`, `done`. A new item with no `state` is `pending`. | A call with any other value fails with a message that lists the 9 kinds, and nothing is written. |
| FR-06 | The mod sets timestamps itself: `updatedAt` on every change of a feature or task; `startedAt` the first time a task or feature leaves `pending`; `finishedAt` when it enters `done`, cleared when it leaves `done`. The flow does not send timestamps. | After `pending → active → done`, the stored task has `startedAt ≤ finishedAt`; after `done → fixing`, `finishedAt` is empty. |
| FR-07 | Each feature is stored as one JSON file, named from its `id`, in a folder set by a `userConfig` option whose default is `.claude/feature-progress/` under the session's working directory. The mod creates the folder when it does not exist. | After a report, the file exists in the configured folder and holds the merged state; a changed option makes the next report write in the new folder. |
| FR-08 | The tool returns a short confirmation with the feature stage and the `n/m` count, or an error that says what to fix. | A valid call returns, for example, `feature-progress: review #2 · 12/17`; an invalid call returns the reason and the stored file stays unchanged. |
| FR-09 | A band above the prompt shows the not-done feature with the latest `updatedAt`: its title, its stage (label, or kind when no label, plus `#round` when set), its `n/m` count and the stale marker of FR-14 when it applies. With no not-done feature, the band is hidden. | With 2 not-done features, the band shows the one updated last; after that feature becomes `done`, the band shows the other; with none, no band is drawn. |
| FR-10 | Pressing the band opens the pane. A slash command `/feature-progress` opens the pane, or closes it when it is open. | Both actions open the pane; running the command with the pane open closes it. |
| FR-11 | The pane lists every not-done feature, the one with the latest `updatedAt` first and expanded, the others collapsed. Done features are in one collapsed "Done" section. Each feature row shows the stage, the `n/m` count and "updated X ago". | With 3 stored features (2 not done, 1 done), the pane shows 2 feature rows (the latest expanded) and 1 collapsed "Done" section. |
| FR-12 | Inside a feature, tasks without `group` come first, then one block per `group` in the order the group first appeared. Each task row shows an icon and a word for its kind, `#round` when set, a bar with `done/total` when `steps` is set, its duration from `startedAt`, and its `note` on a line below when set. | A task with `state: "active"` and `steps: {done: 2, total: 5}` shows the active icon, the word, a bar and `2/5`; tasks with `group: "Review #1"` show under that heading. |
| FR-13 | The feature count `n/m` uses all tasks of the feature: `n` is the tasks in `done`, `m` is all tasks, correction tasks included. | A feature with 10 planned tasks done and 7 correction tasks of which 2 are done shows `12/17`. |
| FR-14 | A feature that is not `done` and not `waiting`, and whose `updatedAt` is older than the `userConfig` limit in minutes (default 30), shows a stale marker in the band and in the pane. The relative times and the marker refresh on a timer that does not read the disk. | With the limit at 1 minute and no report for 2 minutes, the marker shows; a new report removes it. |
| FR-15 | A task with `link` shows a control that opens that path, with a `userConfig` `editor` option: `auto`, `vscode` or `system`. `auto` uses VS Code when its command is available, otherwise the system's default program. A relative path resolves from the session's working directory. | With `editor: "system"`, pressing the control opens the file in the default program; a missing file shows a toast that names the path. |
| FR-16 | The mod reads the stored files at session start and when the person presses a Refresh control in the pane. It does not poll the disk. A report from the same session redraws the band and the pane at once. | A file changed by another session shows only after Refresh or a new session; no disk read happens between them except on a report. |
| FR-17 | The command `/feature-progress clean` deletes the stored files of every `done` feature and reports how many it deleted. Files of not-done features stay. | With 2 done and 1 active feature stored, the command deletes 2 files, shows "Deleted 2 done features", and the active feature stays. |
| FR-18 | A stored file that cannot be read as a valid feature is skipped in the band and the pane, and the pane shows a warning with its path. A report for that feature fails with a message, and the mod does not overwrite the file. | A file with broken JSON produces one warning row; a report for its `id` returns an error and the file bytes stay the same. |
| FR-19 | The skills of the user's SDD flow call the tool at each state change, in both variants: `sdd-orchestrate-flow` / `sdd-orquestrar-fluxo` (feature stage), `sdd-plan-tasks` / `sdd-planejar-tasks` (initial task list), `sdd-orchestrate-tasks` / `sdd-orquestrar-tasks` and `sdd-execute-task` / `sdd-executar-task` (task `active`, `steps`, `done`, `blocked`), `sdd-plan-corrections` / `sdd-planejar-correcoes` (correction tasks in a group), `sdd-execute-corrections` / `sdd-executar-correcoes` (correction task states). Delegated review and QA subagents do not call it; the orchestrating session reports their start and end. The Portuguese variant has no QA stage, so its skills never report `qa`. | Each listed skill, in each variant, has the report step at its state changes, and the step applies only when the tool is available. |
| FR-20 | The SDD skills map their states to the 9 kinds as follows. Feature: `product` and `plan-project` → `planning`; `implementation` → `active`; `review` → `review` with the review number as `round`; `corrections` → `fixing` with the round; `qa` → `qa` with the QA number as `round`; `awaiting-hil` and `acceptance` → `waiting`; `blocked` → `blocked`; `completed` → `done`. Task: `pending`, `active`, `done` and `blocked` only. Correction tasks have `group` "Review #N" or "QA #N". The Portuguese variant maps its translated phase and status names to the same kinds and has no `qa` row. | A full flow run with one review round and one correction round shows, in order: planning, active, review #1, fixing #1, review #2, qa #1, waiting, done; correction tasks show under "Review #1". |
| FR-21 | The mod's README documents the contract for other flows: tool name, input schema, merge and `remove` rules, the 9 kinds and their meaning, the timestamps, the storage folder and a `.gitignore` recommendation, and at least 2 example calls (creating a feature with tasks, and moving a task to `done`). | A reviewer who reads only the README writes a valid first call and a valid update call. |
| FR-22 | A `userConfig` boolean `showBand` (default `true`) hides the band when `false`; the pane, the reports and the command still work. The command `/feature-progress band` flips the option as a change in `/config` does, so the value persists across `/clear`, `/resume` and new sessions, and confirms the new value. | With `showBand: false` and an open feature, no band is drawn and `/feature-progress` still opens the pane; `/feature-progress band` shows the band again and `/config` shows `showBand: true`. |
| FR-23 | The pane and the band have a modern look: the stage as a colored chip, a meter of done tasks, framed feature cards, colored state glyphs. A `userConfig` string `paneBackground` (default empty) paints the pane body in the terminal with a hex or named color, as session-info does. A `userConfig` choice `icons` (`unicode` default, `nerd`, `emoji`) picks the state glyphs. | With `paneBackground: "#2e3440"` the terminal pane body has that background and the desktop pane has none; with `icons: emoji` the band shows the emoji of the state; the default draws the `unicode` glyphs. |

## Non-functional requirements

| ID | Attribute | Limit or criterion |
| --- | --- | --- |
| NFR-01 | Supported API | The mod uses only the documented mod API and tool fields; no `@internal` member, no undocumented endpoint, no credential read from disk (AGENTS.md). |
| NFR-02 | Disk access | No periodic disk read. The mod reads the folder at session start, on Refresh, and on a report (the target file only). |
| NFR-03 | File size | One feature file stays under the 4 MiB limit of `$.fs.read`/`$.fs.write`; a report that would pass it fails with a message and writes nothing. |
| NFR-04 | Accessibility | A state is never shown by color only: each kind has an icon and a word. Nothing animates. |
| NFR-05 | Narrow widths | Below 44 columns the pane drops frames, as session-info does, and the band shortens the title before it drops the stage or the count. |
| NFR-06 | Language | All UI strings, tool messages, comments and the README are in English (AGENTS.md). The `label`, `title`, `note` and `group` values that a flow sends are shown as received. |
| NFR-07 | Platform | Works on Windows, macOS and Linux, including the `link` control and the clean command. |
| NFR-08 | Skill safety | A skill with the report step completes with no error and no extra question when the mod is not installed. |
| NFR-09 | Quality gate | `claude plugin validate .`, `claude plugin validate feature-progress` and `claude plugin test feature-progress` pass (AGENTS.md). |

## User experience

- **Band (one line above the prompt):** `<title> · <stage> · <n>/<m>`, plus a stale marker when FR-14 applies. Example: `feature-progress · fixing #1 · 12/17`. A survey of the engine takes the band first; the mod yields to it.
- **Pane:** a header with the Refresh control; one block per not-done feature (latest first and expanded); a collapsed "Done" section; a warning row per unreadable file (FR-18).
- **Feature block:** stage, `n/m`, "updated X ago", the feature `note` when set, then the task rows grouped as in FR-12.
- **Task row:** icon and word for the kind, `#round`, the steps bar with `done/total`, the duration, a `link` control when set, and the `note` below.
- **Empty state:** with no stored feature, `/feature-progress` opens the pane with the line "No feature has reported progress yet." and a pointer to the README contract.
- **Toasts:** clean result (FR-17), missing link target (FR-15).

## Constraints and dependencies

- New top-level mod folder `feature-progress/` with `.claude-plugin/plugin.json`, `hooks/`, `tests/*.test.ts` and a `README.md` whose Install section uses `/plugin install feature-progress --marketplace dougcunha/claude-mods`; register it in `.claude-plugin/marketplace.json` and add a row to the root README Mods table (AGENTS.md).
- The mod API has no file watch (`$.fs` offers `read`, `write`, `list`, `exists`, `stat`, `ancestors`) and no file delete; the clean command needs a supported way to delete files, which the TechSpec chooses (for example `$.process.run`).
- The band is the engine's `AbovePrompt` site; engine surveys take it first.
- In this environment the `cc-plugin-sec-default` policy skips user hooks on `classic.*` and `prompt.compose`, so the mod cannot depend on a `FileChanged` hook or a system-prompt section; the tool description and the skills carry the usage.
- The Portuguese skill variant lives in a separate Git repository, `D:\Projetos\agents-instructions`; its changes are committed there.
- The two skill variants differ in content; each change is written for its variant, not copied.
- session-info stays unchanged.
- Writing the feature files in the repository is an exception to `.agents/rules/mod-runtime.md` ("writes files only … under the temporary directory"), approved by the user on 2026-10-25; the same delivery records the exception in that rule.

## Out of scope

- Reading flow artifacts (pull or adapters) such as `tasks.md`, `checkpoint.json` or report folders.
- Disk polling, file watching and live updates from other sessions without Refresh.
- Reports from subagents; concurrent writers beyond "the last write wins".
- Task dependencies (`dependsOn`) and a DAG view.
- History of states, charts, cost or token data.
- Editing `.gitignore` or any file outside the storage folder.
- Changes to session-info, and a section of this view inside session-info.
- More than one repository per session.

## Assumptions and sources

- Product decision (grilling session, 2026-10-24): push contract through one tool, new mod, persistence in JSON per feature, partial merge with `remove`, the 9 kinds, flat list with `group`, band plus pane, stale marker with a configurable limit, `link` with the session-info `editor` logic, no polling with a Refresh control, tool name `report`, mod name `feature-progress`, SDD skill changes in both variants in this delivery.
- Assumption: a `waiting` feature never shows the stale marker, because a wait for a human is expected to be long. If wrong, the marker shows during HIL gates.
- Assumption: the clean command does not ask for confirmation, because it deletes only files of `done` features. If wrong, a confirmation step is added.
- Assumption: each report reads the stored file, merges into it and writes it back, so two sessions that report the same feature lose a report only when both write at the same moment. If wrong, a lock is needed.
- Product decision (W-09, 2026-10-25): an option to hide the band, as a `userConfig` field plus a command that flips it (FR-22).
- Product decision (W-10, 2026-10-25): a pane background option as in session-info, an icon set option, and a more modern look with better colors and icons (FR-23).
- Assumption: the folder number `02` follows the implementation order, after `prd-01-visual-review` (commit `1c8ad18`, removed in `2ee1026`).
- Pending: the Portuguese variant has no separate QA skill (no `sdd-execute-qa` counterpart in `D:\Projetos\agents-instructions\SKILLS`); the TechSpec identifies where that variant runs QA and puts the `qa` report there.
- Local source: `session-info/.claude-plugin/types/claude-code/index.d.ts` (`$.tool.register`, `$.command.register`, `$.fs.*` at 3298-3425 with the 4 MiB limit, `$.clock.every`, `$.process.run`, the `AbovePrompt` band, `$.ui.open`).
- Local source: `session-info/hooks/viewer.ts` (`editor` option `auto | vscode | system`) and `session-info/hooks/tabs.ts` / `cards.tsx` (frames dropped below 44 columns).
- Local source: `.agents/skills/sdd-orchestrate-flow/assets/checkpoint.template.json` and `references/hil-state.md` (phases, statuses, `correction_round`), `.agents/skills/sdd-plan-tasks/assets/tasks.template.md` (task states `pending`/`completed`).
- Prior art: the `savvy-progress` plugin (claude-kit marketplace) reports progress through registered tools `progress` and `step`.

## PRD acceptance gate

- [x] Every requirement has an ID and an observable criterion.
- [x] Metrics, boundaries, and out-of-scope items are explicit.
- [x] Internal rules came from the user or an identified project source.
- [x] Implementation details remain in the TechSpec.
