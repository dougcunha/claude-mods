<h1 align="center">🧹 session-cleanup</h1>

<p align="center">
  A Claude Code mod that lists the temporary files a session created and the Git items it left, so you choose what to remove and what to ask Claude to fix.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdougcunha%2Fclaude-mods%2Fmain%2Fsession-cleanup%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&color=blue" alt="Version">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Claude%20Code-2.1.316-d97757.svg" alt="Tested on Claude Code 2.1.316">
</p>

<p align="center">
  <a href="#-install">Install</a> ·
  <a href="#-use">Use</a> ·
  <a href="#-settings">Settings</a> ·
  <a href="#-limitations">Limitations</a> ·
  <a href="#-development">Development</a>
</p>

## ✨ What it does

`/cleanup` opens a pane with 2 checklists. Nothing is removed or changed until you press the apply button.

- 🗂️ **Files**: the files and folders the session **created** that are still there and that Git does not track. A file that existed before the session is never listed, even when the session changed it. The mod collects the paths from 4 sources:
  - The files [session-info](../session-info/) records as created (Write, and shell commands inside a repository).
  - The paths a Bash or PowerShell command names as its output, checked before and after the command runs: redirects (`>`, `>>`), `touch`, `mkdir`, `tee`, `cp`, `mv`, `Set-Content`, `Out-File`, `New-Item`, `Copy-Item`, `Move-Item`, `curl -o`, `Invoke-WebRequest -OutFile`, `git clone`, `python -m venv` and others.
  - The entries of the system temp folder (`TEMP`, `TMP`, `TMPDIR`) changed since the mod loaded.
  - The session's scratchpad folder.
- 🌿 **Git**: for the repository of the session folder and every repository where the session touched a file:
  - tracked files with uncommitted changes, staged or not;
  - submodules with a commit the parent does not record, uncommitted changes or untracked files, and a submodule's detached HEAD or unpushed commits;
  - a detached HEAD;
  - commits not pushed to the upstream, or a branch with no upstream.

A file is **pre-selected** when it is in a temp folder, has a temporary name (`tmp`, `temp`, `scratch`, `debug_`, `test_out`, `*.log`, `*.bak`, `*.orig`, `*.swp`, `*~`) or lies outside every repository. A file of the scratchpad is pre-selected too. A folder the session created is 1 row, with its size. No Git item is pre-selected.

Rows fold by folder, so a long list stays short:

- **Temporary for certain:** the scratchpad, and what the session created in a temp folder. When a folder holds 2 or more of them, they are 1 row, such as `◉ 4 entries in scratchpad/`, pre-selected.
- **Found only by the temp folder scan:** other programs write there too. All of them are 1 row per temp folder, such as `○ 15 entries in Temp/`, tagged `other programs write here too` and not pre-selected.

A folded row removes each entry it stands for, never the folder itself. When more than 3 entries fail for one reason, the result shows 1 line with the count, such as `✗ 12 entries: in use by another program`.

The mod never lists the session folder, its repository, a folder that holds them, the home folder, a temp folder itself, anything under `~/.claude`, or Git's own data.

## 🚀 Install

```text
/plugin install session-cleanup --marketplace dougcunha/claude-mods
```

Answer `y` to add the marketplace, then pick a scope. The mod needs [session-info](../session-info/): install it too.

## 🎮 Use

1. Type `/cleanup` before you end the session.
2. Wait for the scan. The pane shows the **Files** and **Git** sections.
3. Press a row to select or clear it. Press **all** or **none** beside a section title to change the whole section.
4. Press the apply button. Its label says what it does, for example `Remove 3, ask Claude to fix 1`.

- The chosen files go to the system trash, by default. See [Settings](#-settings).
- The chosen Git items go to Claude as 1 prompt. The prompt tells Claude to check each item and to ask you before it commits, pushes, discards changes or moves a HEAD.
- After the apply, the mod scans again and shows the result under the buttons: 1 line for what it removed, then 1 red line per file it could not remove, with the reason, such as `in use by another program`. A file another program holds is not moved to the quarantine, as the move would fail the same way.

**Rescan** scans again. **Close** or Esc closes the pane.

## 🔧 Settings

Set them in `/config`, under session-cleanup.

| Setting | Default | What it does |
| --- | --- | --- |
| `removeMode` | `trash` | `trash`: the system trash (the Recycle Bin on Windows, `gio trash` on Linux, the Finder on macOS); a file the trash refuses goes to the quarantine folder. `quarantine`: move to `~/.claude/cleanup-quarantine/<time>/`, with a `manifest.json` of where each file came from. `delete`: delete for good. |
| `quarantineDays` | `7` | When a session starts, the mod deletes the quarantine runs older than this many days. |

## 🚧 Limitations

- **No menu at exit.** The API runs the `session.end` hook in at most 1.5 seconds and cannot hold the exit, so the mod cannot ask at exit. Run `/cleanup` before you leave.
- **Files a program or a script writes.** The mod reads the paths a shell command names. It does not see a file that a script, a build or a test run writes, unless session-info sees it (inside a repository) or it is a new entry of the system temp folder.
- **Files a shell command creates outside a repository.** session-info does not record these on every platform, so the mod reads the command itself. A path with an unknown variable, a command substitution or a glob is skipped.
- **The scratchpad folder.** No API gives its path. The mod looks for `<temp>/claude/<project>/<session id>/scratchpad`, where Claude Code keeps it today. When Claude Code moves it, this source finds nothing.
- **Additional working directories.** No API lists them. The mod checks the repositories where the session touched a file instead.
- **The relative paths of a shell command** are read against the session's folder and any `cd` earlier in the same command.

## 🔨 Development

```text
claude plugin validate ./session-cleanup
claude plugin test ./session-cleanup
```

- `hooks/shell.ts` reads the output paths of a shell command.
- `hooks/git.ts` reads `git status --porcelain=v2` and writes the Git items and the prompt.
- `hooks/candidates.ts` holds the rules: temporary names, guarded paths, folder grouping and pre-selection.
- `hooks/scan.ts` collects the entries; `hooks/apply.ts` and `hooks/remove.ts` remove them.
- `hooks/pane.tsx` draws the pane; `hooks/register.tsx` wires the hooks.

## 📄 License

[MIT](../LICENSE)
