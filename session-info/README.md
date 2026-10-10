# session-info

A Claude Code mod with one pane and two sections:

- **Usage**: your plan's rate-limit windows as bars, like `/usage`, updated live.
- **Changes**: every file the current session created, modified or deleted, in a treeview. Pressing a new file opens it in your editor; pressing a modified or deleted file opens its diff in the diff viewer configured on your machine.

```text
▾ Usage
Current session                    resets in 2h 10m
██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 3%
Current week (all models)          resets in 5d 21h
██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 28%

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
| Fold or unfold a section | Press its `▾ Usage` or `▾ Changes` header |
| Open a file | Click the file in the fullscreen terminal, or move to it with Tab or the arrow keys and press Enter. A new file (`A`) opens in the editor; a modified (`M`) or deleted (`D`) file opens as a diff |
| Collapse or expand a folder | Press the folder |
| Collapse all, expand all, clear the list | `c`, `e`, `x`, or the buttons at the bottom |
| Return to the prompt | `Esc` |

Status colors follow your theme: green for created (`A`), yellow for modified (`M`), red and struck through for deleted (`D`). Chains of single-child folders collapse into one row, for example `src/app/ui`.

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
| `session-info.sections` | `all`, `usage`, `changes` | `all` |
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
| `hooks/register.tsx` | The commands, the `tool.call` tracker, the usage refresh and the pane |
| `hooks/usage.ts` | Window labels, bars and reset countdowns |
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
