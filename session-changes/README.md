# session-changes

A Claude Code mod that lists every file the current session created, modified or deleted in a treeview pane. Pressing a file opens its diff in the diff viewer configured on your machine.

```text
3 arquivos                         ✚ 1  ● 1  ✖ 1
├─ ▾ src
│  ├─ ▾ app
│  │  └─ ● main.ts  M
│  ├─ ✚ new.ts  A
│  └─ ✖ old.ts  D
[ recolher ]  [ expandir ]  [ limpar ]
```

The pane's labels are in Portuguese.

## Install

At the Claude Code prompt:

```text
/plugin install session-changes --marketplace dougcunha/claude-mods
```

Answer `y` to add the marketplace and choose a scope. If you already added the marketplace:

```text
/plugin install session-changes@claude-mods
```

## Use

| Action | How |
| --- | --- |
| Open the pane | `/changes` |
| Open a file's diff | Click the file in the fullscreen terminal, or move to it with Tab or the arrow keys and press Enter |
| Collapse or expand a folder | Press the folder |
| Collapse all, expand all, clear the list | `c`, `e`, `l`, or the buttons at the bottom |
| Return to the prompt | `Esc` |

Status colors follow your theme: green for created (`A`), yellow for modified (`M`), red and struck through for deleted (`D`). Chains of single-child folders collapse into one row, for example `src/app/ui`.

## How the diff opens

The diff compares the file **as it was before the session first touched it** with the file as it is now, not with `HEAD`. The original content is saved under `%TEMP%` (or `$TMPDIR`) in `claude-session-changes/<session id>/`.

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
| `session-changes.viewer` | `auto`, `git`, `vscode`, `inline` | `auto` |
| `session-changes.icons` | `unicode`, `nerd` (needs a [Nerd Font](https://www.nerdfonts.com/)), `emoji` | `unicode` |

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

## Development

```text
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

| File | Role |
| --- | --- |
| `hooks/register.tsx` | The `/changes` command, the `tool.call` tracker and the pane |
| `hooks/track.ts` | Turns tool results into created, modified or deleted entries |
| `hooks/git.ts` | `git status`, `HEAD` content and snapshots |
| `hooks/viewer.ts` | Picks and launches the diff viewer |
| `hooks/tree.ts` | Builds and flattens the tree |
| `hooks/icons.ts` | Icon sets and status colors |
| `hooks/patch.ts` | Reverses hunks to recover a file's previous content |
| `hooks/host.ts` | The engine calls the helper modules use |
| `types/index.d.ts` | The `$.state` contract |
