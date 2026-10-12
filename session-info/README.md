# session-info

A Claude Code mod with one pane and six sections:

- **Session**: the context window's fill, compactions, the session's cost and duration, and turn stats.
- **Usage**: your plan's rate-limit windows as bars, like `/usage`, updated live.
- **Agents**: the session's subagents and teammates with their status, children under the agent that spawned them.
- **Checks**: whether the last build and the last test run the session started passed, with the error lines of a failed build or the names of the failed tests. .NET, Node, Bun, Rust, Go and Python tools are recognized.
- **Git**: the branch and whether it is on the remote, the working-tree counts, the last commit, a merge or rebase in progress, and the submodules that changed. Pressing the branch name opens your Git client, such as lazygit, in a new terminal window.
- **Changes**: every file the current session created, modified or deleted, in a treeview. Pressing a new file opens it in your editor; pressing a modified or deleted file opens its diff in the diff viewer configured on your machine.

It also raises a native notification when a usage window reaches 80% or 90%, or the context window reaches 85%, even with the pane closed.

Each section is a card with a rounded frame that lights up under the pointer in the fullscreen terminal, and a row of tiles above them shows the cost, the elapsed time, the turn count and the context fill at a glance. Bars fill to the eighth of a cell. In a terminal pane narrower than 44 columns the frames and tiles step aside and the sections draw bare, as in earlier versions. The desktop app always draws the frames and tiles, sizing them and the bars by percentage instead of terminal cells.

```text
╭────────────────╮╭────────────────╮╭────────────────╮╭────────────────╮
│ $1.84 cost     ││ 1h 12m elapsed ││ 14 turns       ││ 62% context    │
╰────────────────╯╰────────────────╯╰────────────────╯╰────────────────╯
╭──────────────────────────────────────────────────────────────────────╮
│ ▾ Session                                                            │
│ ▸ Context                                 124k / 200k · 1 compaction │
│ ██████████████████████████████████████▌░░░░░░░░░░░░░░░░░░░░░░░ 62%   │
│ 14 turns · ~250 output tok/turn · last 38s                           │
╰──────────────────────────────────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────╮
│ ▾ Usage                                                              │
│ Current session                                     resets in 2h 10m │
│ ██▏░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 3%    │
│ Current week (all models)                           resets in 5d 21h │
│ █████████████████▍░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 28%   │
╰──────────────────────────────────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────╮
│ ▾ Agents                                          2 running · 1 done │
│ ⟳ reviewer · review diff                                             │
│   ⟳ Explore · nested search                                          │
│ ✓ Explore · find auth code                                           │
╰──────────────────────────────────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────╮
│ ▾ Checks                                            ✖ build  ✓ tests │
│ ✖ Build  2 errors                                          4m 2s ago │
│   dotnet build App.sln                                               │
│   Class1.cs(8,16): CS0103: The name 'total' does not exist in the c… │
│ ✓ Tests  120 passed                                  agent · 38s ago │
│   rtk dotnet test --project tests/App.Tests                          │
╰──────────────────────────────────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────╮
│ ▾ Changes                                     3 files  ✚ 1  ● 1  ✖ 1 │
│ ├─ ▾ src                                                             │
│ │  ├─ ▾ app                                                          │
│ │  │  └─ ● main.ts  M                                                │
│ │  ├─ ✚ new.ts  A                                                    │
│ │  └─ ✖ old.ts  D                                                    │
│                                                                      │
│ [ collapse ]  [ expand ]  [ clear ]                                  │
╰──────────────────────────────────────────────────────────────────────╯
```

## Install

At the Claude Code prompt:

```text
/plugin install session-info --marketplace dougcunha/claude-mods
```

Answer `y` to add the marketplace and choose a scope. If you already added the marketplace:

```text
/plugin install session-info@claude-mods
```

## Use

| Action | How |
| --- | --- |
| Open the pane | `/session-info` (or `/changes`). To open it when the session starts, set `session-info.openOnStart` to `true` |
| Fold or unfold a section | Press its `▾ Session`, `▾ Usage`, `▾ Agents`, `▾ Checks`, `▾ Git` or `▾ Changes` header |
| Open the Git client | Press the branch name in the `▾ Git` header, or press `g` while the pane has the focus |
| Show the context breakdown by category | Press `▸ Context` |
| Open a file | Click the file in the fullscreen terminal, or move to it with Tab or the arrow keys and press Enter. A new file (`A`) opens in the editor; a modified (`M`) or deleted (`D`) file opens as a diff |
| Collapse or expand a folder | Press the folder |
| Collapse all, expand all, clear the list | `c`, `e`, `x`, or the buttons at the bottom |
| Return to the prompt | `Esc` |

Status colors follow your theme: green for created (`A`), yellow for modified (`M`), red and struck through for deleted (`D`). Chains of single-child folders collapse into one row, for example `src/app/ui`.

## What the Session section shows

| Row | Source |
| --- | --- |
| Cost, elapsed and turns (tiles) | The session's cost as `/cost` totals it, the time since the session started, and the main-thread turn count. In a narrow pane, cost and duration move to the section header |
| Context bar | The live context window: tokens used, the window size and the percentage. Pressing `▸ Context` unfolds the categories (messages, system prompt, tools, MCP), estimated locally |
| Compactions | Compactions that went through in the main conversation |
| Turns | Main-thread turns, their average output tokens, and how long the last one took |

The turn and compaction counts start when the mod loads, so a reload or a newly installed mod starts them at zero.

## What the Agents section shows

Every agent loop of the session, as Claude Code lists it: subagents the model or a plugin spawned and teammates. Each row shows a status glyph, the agent's name (or its type) and its task description:

| Glyph | Status |
| --- | --- |
| `⟳` | running |
| `⏸` | waiting |
| `◌` | pending |
| `○` | idle (a teammate waiting for a message) |
| `✓` | completed |
| `✖` | failed |
| `⊘` | killed |

Active agents come first; an agent spawned by another is indented under it. Claude Code drops a finished agent from its list some time after it ends, and the row leaves with it. The section redraws when an agent starts or finishes a turn, and once a minute. Up to 8 rows are shown.

## What the Checks section shows

One row for the last build and one for the last test run, from any shell command the session ran, a subagent's included (marked `agent`). A command counts when one of its segments runs a known tool, so `cd app && npm test` and `rtk dotnet test …` count too:

| Check | Commands |
| --- | --- |
| Build | `dotnet build`, `dotnet publish`, `dotnet pack`, `npm`/`pnpm`/`yarn`/`bun run build`, `bun build`, `tsc`, `vite`/`next`/`nuxt`/`astro`/`ng build`, `cargo build`, `cargo check`, `go build`, Gradle and Maven builds |
| Tests | `dotnet test`, `dotnet run` of a test project, `npm`/`pnpm`/`yarn`/`bun test`, `bun test`, `jest`, `vitest`, `mocha`, `playwright test`, `node --test`, `cargo test`, `go test`, `pytest` |

Add your own commands, such as `make test` or `./build.ps1`, with the `buildPattern` and `testPattern` settings.

The status comes from the command's exit code; an interrupted or timed-out command shows as failed. When a pipe hid the exit code (`dotnet test | tail -3`), the summary in the output decides. The details come from the output itself:

| Check | Shows |
| --- | --- |
| A failed build | The error count and the first error lines (`file(line,col): code: message`). With no recognizable error line, the last lines of the output |
| A test run | `12 passed`, or `2 failed / 120` with the first failed test names. A test run that did not compile shows the compile errors |
| A command run in the background | `running in background`, until the next run of that kind |

The output is read as the model got it: raw, filtered by RTK, or localized. Localized .NET output (`Com falha! – Com falha: 2, Aprovado: 1, …`) is read by its structure, not its words. When RTK cut the output and points to the whole log (`[full output: …]`), or wrote a vitest JSON report in its place, the mod reads that file for the counts and names.

The readers were checked against real output of `dotnet build` and `dotnet test` (VSTest and Microsoft.Testing.Platform, English and Portuguese), tsc, jest, vitest, `node --test`, Bun and `cargo test`, each with and without RTK. Go and pytest are read by their documented formats.

## What the Git section shows

The section shows the repository of the session's folder and only what differs from a clean state. A row with nothing to say is left out, so a clean repository takes one row under the header.

```text
▾ Git                                   g: ⎇ main ↑2 ↓1
  ⚠ Rebase in progress: step 3 of 7
  ✖ 1 conflict  ● 2 staged  ✎ 3 modified  ? 1 untracked
  ◆ a1b2c3d feat: add the Git section               12m
  ◇ 4 submodules · 2 changed
    libs/core  new commit · modified
    libs/ui  not initialized
```

| Row | Shows |
| --- | --- |
| Header | The branch, then `↑` commits ahead of and `↓` commits behind its upstream. `local only` when the branch has no upstream, `upstream gone` when the upstream was deleted on the remote, `detached` and the short hash on a detached HEAD |
| Operation | A merge, rebase (with its step), cherry-pick, revert or bisect that stopped halfway |
| Counts | Conflicts, staged, modified and untracked files, the non-zero ones only. Submodules are not counted here |
| Last commit | Short hash, subject and age |
| Submodules | The submodule count, then one row per submodule that is in conflict, not initialized, on a commit other than the one the repository records (`new commit`), or with changed files (`modified`). Up to 5 rows. Only the submodules of the repository itself are listed; a change in a nested submodule shows as `modified` on its parent |

The mod reads the repository when the session starts, after each shell command or file edit, when you send a prompt, when you open the pane, and once a minute. It runs `git status --porcelain=v2 --branch`, `git log -1`, and `git submodule status` when the repository has a `.gitmodules` file. It never runs `git fetch`, so `↑` and `↓` compare with the last fetch.

### Git client

Pressing the branch name, or `g`, opens the `gitClient` command (default `lazygit`) in a new terminal window, in the repository root:

| System | Window |
| --- | --- |
| Windows | `start`, which opens the default terminal app: Windows Terminal on Windows 11 |
| macOS | Terminal.app |
| Linux | The first of `x-terminal-emulator`, `gnome-terminal`, `konsole` and `xterm` found on the `PATH` |

A toast tells you when the command is not on the `PATH`. Set `gitClient` to empty to make the branch name plain text.

## Alerts

The mod notifies once per threshold through your Claude Code notification channel (`preferredNotifChannel`):

| When | Notification |
| --- | --- |
| A usage window reaches 80%, then 90% | `Current session at 82% · resets in 1h 10m` |
| The context window reaches 85% | `Context at 86% (172k / 200k): compaction is near` |

A usage window alerts again after it resets; the context alert re-arms once the context drops under 85%, for example after a compaction. When notifications are off or the terminal has no channel, the alert shows as a toast instead. Turn alerts off with the `alerts` setting.

## How usage updates

The bars read the same figures as `/usage` and the status line. Claude Code learns them from each API response, so they move after a reply, not while the session is idle. The pane redraws when a window moves a whole point, and once a minute so the reset countdown stays current.

The section shows each window Claude Code reports: the current session (`five_hour`), the current week (`seven_day`) and a gateway's spend limit. Bars turn yellow at 70% and red at 90%. On API-key or other non-subscription accounts there are no windows to show.

## How a file opens

A **new file** opens in your editor. With the `auto` editor that is VS Code when `code` is on the `PATH`, else the app the system associates with the file (`explorer.exe` on Windows, `open` on macOS, `xdg-open` on Linux). Terminal editors such as `$EDITOR` cannot open from the pane.

A **modified or deleted file** opens as a diff. A deleted file whose previous content is unknown (outside git and never captured) opens nothing.

The diff compares the file **as it was before the session first touched it** with the file as it is now, not with `HEAD`. The original content is saved under `%TEMP%` (or `$TMPDIR`) in `claude-session-info/<session id>/`.

With the `auto` viewer, the mod opens the first of these that is available:

1. **git's GUI diff tool**: `git difftool --gui --no-index`, when `diff.guitool` or `merge.guitool` is set. For example, for Beyond Compare:
   ```text
   git config --global diff.guitool bc
   ```
2. **VS Code**: `code --diff`, when `code` is on the `PATH`.
3. **Inline**: the unified diff drawn inside the pane.

## Settings

Change these in `/config`:

| Setting | Values | Default |
| --- | --- | --- |
| `session-info.openOnStart` | `true`, `false` | `false` |
| `session-info.showSession` | `true`, `false` | `true` |
| `session-info.showUsage` | `true`, `false` | `true` |
| `session-info.showAgents` | `true`, `false` | `true` |
| `session-info.showChecks` | `true`, `false` | `true` |
| `session-info.showGit` | `true`, `false` | `true` |
| `session-info.gitClient` | A command, for example `lazygit`, `gitui` or `tig`. Put a path with spaces in double quotes. Empty turns it off | `lazygit` |
| `session-info.showChanges` | `true`, `false` | `true` |
| `session-info.alerts` | `true`, `false` | `true` |
| `session-info.viewer` | `auto`, `git`, `vscode`, `inline` | `auto` |
| `session-info.editor` | `auto`, `vscode`, `system` | `auto` |
| `session-info.paneBackground` | A color for the body of the pane in the terminal: hex such as `#2e3440`, or a color name. Empty keeps the color Claude Code draws. The frame and the close row keep Claude Code's color | empty |
| `session-info.icons` | `unicode`, `nerd` (needs a [Nerd Font](https://www.nerdfonts.com/)), `emoji` | `unicode` |
| `session-info.buildPattern` | A case-insensitive regular expression matched against each command segment, for example `^make( \|$)` | empty |
| `session-info.testPattern` | The same, for test runs, for example `^make test\|^just test` | empty |

With `openOnStart`, Claude Code draws the pane at session start only on a terminal of 144 columns or more, or 110 once you have opened the pane and not closed it by hand. On a narrower terminal the pane waits until you widen the terminal or run `/session-info`. A `-p` run does not open it. A reload of the mod opens it again.

## How changes are detected

| Tool | Source |
| --- | --- |
| Write, Edit, NotebookEdit | The tool's own result, which carries the original content |
| Bash | The per-file diff Claude Code records for the command, including created and deleted files |
| PowerShell | `git status` before and after the command |

After every shell command, the mod also checks that each listed file still exists, so a file that was deleted shows as deleted. A file created and then deleted in the same session leaves the list.

## Limitations

- **PowerShell commands:** a file that was already modified before the command and is modified again is not detected. Outside a git repository, only deletions of files already in the list are detected.
- **Mouse clicks** work in the fullscreen terminal. Elsewhere, use the keyboard.
- **The diff viewer** runs as a child of the mod, so it closes when the mod reloads. On Linux the terminal window of the Git client does too.
- **Binary files** are not handled. The snapshot stores text only.
- **Checks of background commands** stay `running in background`: mods get no event when a background command ends, so the row updates on the next run of that kind.
- **Check details** depend on the tool's output format. When a format is not recognized, the row shows the status and, for a failure, the last lines of the output. `rtk dotnet test` on a Microsoft.Testing.Platform project prints no counts when it passes, so the row says `passed`.
- **Usage** shows only the windows Claude Code exposes to mods. The per-model weekly windows and the `~N tok/turn` total that `/usage` prints come from an endpoint mods cannot reach without your OAuth token, so they are left out.

## Development

```text
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

| File | Role |
| --- | --- |
| `hooks/register.tsx` | The commands, the `tool.call`, `prompt.submit`, `turn.complete`, `agent.spawn` and `session.compact` hooks, the refresh timer and the pane |
| `hooks/cards.tsx` | Framed cards, the tiles row and how the tiles wrap |
| `hooks/usage.ts` | Window labels, bars and reset countdowns |
| `hooks/session.ts` | Token, duration, cost and turn formatting |
| `hooks/agents.ts` | Agent ordering, nesting and status glyphs |
| `hooks/alerts.ts` | Which thresholds a measurement crosses, once per window |
| `hooks/checks.ts` | Which commands are builds or test runs, the record of each run, and its rows |
| `hooks/parse.ts` | Reads error lines, error counts, test counts and failed test names from build and test output |
| `hooks/track.ts` | Turns tool results into created, modified or deleted entries |
| `hooks/git.ts` | `git status`, `HEAD` content and snapshots |
| `hooks/repo.ts` | Reads and parses the repository state for the Git section, and its row texts |
| `hooks/client.ts` | Opens the Git client in a new terminal window |
| `hooks/viewer.ts` | Opens a change: the editor for new files, the diff viewer for the rest |
| `hooks/tree.ts` | Builds and flattens the tree |
| `hooks/icons.ts` | Icon sets and status colors |
| `hooks/patch.ts` | Reverses hunks to recover a file's previous content |
| `hooks/host.ts` | The engine calls the helper modules use |
| `types/index.d.ts` | The `$.state` contract |

## License

[MIT](../LICENSE)
