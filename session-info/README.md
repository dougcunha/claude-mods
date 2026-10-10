# session-info

A Claude Code mod with one pane and four sections:

- **Session**: the context window's fill, compactions, the session's cost and duration, and turn stats.
- **Usage**: your plan's rate-limit windows as bars, like `/usage`, updated live.
- **Agents**: the session's subagents and teammates with their status, children under the agent that spawned them.
- **Changes**: every file the current session created, modified or deleted, in a treeview. Pressing a new file opens it in your editor; pressing a modified or deleted file opens its diff in the diff viewer configured on your machine.

It also raises a native notification when a usage window reaches 80% or 90%, or the context window reaches 85%, even with the pane closed.

```text
▾ Session                          $1.84 · 1h 12m
▸ Context              124k / 200k · 1 compaction
███████████████████████████████░░░░░░░░░░░░░░░░░ 62%
14 turns · ~250 output tok/turn · last 38s

▾ Usage
Current session                    resets in 2h 10m
██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 3%
Current week (all models)          resets in 5d 21h
██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 28%

▾ Agents                       2 running · 1 done
⟳ reviewer · review diff
  ⟳ Explore · nested search
✓ Explore · find auth code

▾ Changes                    3 files  ✚ 1  ● 1  ✖ 1
├─ ▾ src
│  ├─ ▾ app
│  │  └─ ● main.ts  M
│  ├─ ✚ new.ts  A
│  └─ ✖ old.ts  D
[ collapse ]  [ expand ]  [ clear ]
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
| Open the pane | `/session-info` (or `/changes`) |
| Fold or unfold a section | Press its `▾ Session`, `▾ Usage`, `▾ Agents` or `▾ Changes` header |
| Show the context breakdown by category | Press `▸ Context` |
| Open a file | Click the file in the fullscreen terminal, or move to it with Tab or the arrow keys and press Enter. A new file (`A`) opens in the editor; a modified (`M`) or deleted (`D`) file opens as a diff |
| Collapse or expand a folder | Press the folder |
| Collapse all, expand all, clear the list | `c`, `e`, `x`, or the buttons at the bottom |
| Return to the prompt | `Esc` |

Status colors follow your theme: green for created (`A`), yellow for modified (`M`), red and struck through for deleted (`D`). Chains of single-child folders collapse into one row, for example `src/app/ui`.

## What the Session section shows

| Row | Source |
| --- | --- |
| Cost and duration (header) | The session's cost as `/cost` totals it, and the time since the session started |
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
| `session-info.showSession` | `true`, `false` | `true` |
| `session-info.showUsage` | `true`, `false` | `true` |
| `session-info.showAgents` | `true`, `false` | `true` |
| `session-info.showChanges` | `true`, `false` | `true` |
| `session-info.alerts` | `true`, `false` | `true` |
| `session-info.viewer` | `auto`, `git`, `vscode`, `inline` | `auto` |
| `session-info.editor` | `auto`, `vscode`, `system` | `auto` |
| `session-info.icons` | `unicode`, `nerd` (needs a [Nerd Font](https://www.nerdfonts.com/)), `emoji` | `unicode` |

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
- **The diff viewer** runs as a child of the mod, so it closes when the mod reloads.
- **Binary files** are not handled. The snapshot stores text only.
- **Usage** shows only the windows Claude Code exposes to mods. The per-model weekly windows and the `~N tok/turn` total that `/usage` prints come from an endpoint mods cannot reach without your OAuth token, so they are left out.

## Development

```text
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

| File | Role |
| --- | --- |
| `hooks/register.tsx` | The commands, the `tool.call`, `turn.complete`, `agent.spawn` and `session.compact` hooks, the refresh timer and the pane |
| `hooks/usage.ts` | Window labels, bars and reset countdowns |
| `hooks/session.ts` | Token, duration, cost and turn formatting |
| `hooks/agents.ts` | Agent ordering, nesting and status glyphs |
| `hooks/alerts.ts` | Which thresholds a measurement crosses, once per window |
| `hooks/track.ts` | Turns tool results into created, modified or deleted entries |
| `hooks/git.ts` | `git status`, `HEAD` content and snapshots |
| `hooks/viewer.ts` | Opens a change: the editor for new files, the diff viewer for the rest |
| `hooks/tree.ts` | Builds and flattens the tree |
| `hooks/icons.ts` | Icon sets and status colors |
| `hooks/patch.ts` | Reverses hunks to recover a file's previous content |
| `hooks/host.ts` | The engine calls the helper modules use |
| `types/index.d.ts` | The `$.state` contract |

## License

[MIT](../LICENSE)
