<h1 align="center">🗺️ visual-review</h1>

<p align="center">
  A Claude Code mod that shows the design of a change as a diagram in the browser, so you review the classes, relations and tables before you read the diff.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdougcunha%2Fclaude-mods%2Fmain%2Fvisual-review%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&color=blue" alt="Version">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Claude%20Code-2.1.308-d97757.svg" alt="Tested on Claude Code 2.1.308">
</p>

<p align="center">
  <a href="#-install">Install</a> ·
  <a href="#-use">Use</a> ·
  <a href="#-settings">Settings</a> ·
  <a href="#-limitations">Limitations</a> ·
  <a href="#-development">Development</a>
</p>

## ✨ What it does

At the end of a task, the diff shows the implementation, not the design. `/visual-review` collects the changes of your branch against a base and asks the session to analyze them:

1. 🔎 **Collect:** the command finds the base and the changed files with read-only Git commands, and answers `Analyzing the design of <n> changed files against <base>.` A status line under the prompt reads `Analyzing the design of the change…`.
2. 🤖 **Analyze:** the mod sends 1 prompt to the session. Claude starts 1 subagent (the `analysisModel` setting) that reads the diff and sends a design model to the mod's `submit_model` tool: the classes and modules, their relations, size and quality notes, and the database tables.
3. ✅ **Check:** the mod accepts the model only when each changed source file (`.cs`, `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.py`, `.sql`, `.prisma`) is covered, every relation names a unit of the model, and each unit's line range starts at its name. Otherwise the tool result lists the gaps, and the subagent sends the model again.
4. 📐 **Measure:** the mod reads the line changes from Git again (`git diff -U0`), not from the model: each unit gets the lines added and removed inside its range, each file the lines outside every unit, and each unit its Ce (the units it depends on) and Ca (the units that depend on it) from the relations. It writes the view model to `<temp>/claude-visual-review/<session id>/view.json`.
5. 🌐 **Serve:** the mod starts a small Node.js server (`server/server.mjs`, no package) on `127.0.0.1` and opens the page in your default browser. A toast reads `visual-review: Visual review ready: <link>`. When you run `/visual-review` again with the page open, the open tab shows the new model and no new tab opens.
6. 📄 **Static page without Node.js:** when `node` is not on the `PATH`, or the server stops before it gives its link, the mod writes `review.html` and `view.js` next to `view.json` and opens that file in the browser. A toast says why, for example `visual-review: Node.js not found. The page is static: use Copy review to send the comments. Page: <link>`.

## 🗺️ The page

- **Toolbar:** the base and the branch, the counts of added, modified and deleted units and tables, and a filter: units and tables, units only, or tables only. The filter redraws the diagram with no reload.
- **Containers:** units sit in their namespace (C#) or folder (TypeScript, JavaScript, Python). A container that holds only unchanged neighbors starts closed. Click its header, or press Enter or Space on it, to open or close it; an arrow to a unit in a closed container goes to the container. Arrows of the same kind that meet there merge into 1, whose label counts each state, for example `dependency · 2 relations (+1 =1)`; open the container to comment on one of them.
- **Unit cards:** a state badge (`+` added, `~` modified, `−` deleted, `ctx` an unchanged neighbor, in gray), the name and kind, the total lines, the lines added and removed, the number of methods, `C 1`–`C 5` cohesion with its reason as a tooltip, Ce and Ca, the summary, and the changed members with their state. A card whose file could not be read for the range check says so.
- **Relations:** inheritance and implementation end in a hollow triangle, a dependency in an open arrow, a composition starts with a filled diamond. Implementation and dependency lines are dashed. A label in the middle of each arrow names the kind and the state (`added`, `removed`, `unchanged`).
- **Tables:** a dashed group of the database tables, each with its columns, their state, a type change (`nvarchar(100) → nvarchar(200)`), the primary key and the foreign keys. A dotted line links an entity unit to its table.
- **Other files:** the changed files outside the diagram, with their line counts, and the generated files the analysis skipped, with the reason.
- **Comments:** click a card, a changed member, an arrow label, a table or a column, or press Enter on it, to open the comment form in the side panel; **Comment on the whole review** comments on everything. Choose **Change request** or **Question**, write, and **Save**. A count shows next to each element with comments. Edit or delete a comment of this round before you submit.
- **Submit review:** sends every comment of this round as 1 prompt to the session, grouped by element, with its type. Claude answers the questions, proposes a plan for the change requests, and changes no file before you confirm the plan. When Claude is busy, the prompt waits until the turn ends: the page says `Review handed to the session`, then `Review sent.` once the prompt entered. When nothing is new, or a hook drops the prompt, the page says why and keeps your comments.
- **Copy review (static page):** the button in place of **Submit review** copies the same review text to the clipboard. Paste it in the Claude Code prompt. The static page keeps your comments in the browser's storage, per branch and base commit, so a reload or the next static page of the same review shows them again.
- **Rounds:** after the next `/visual-review` on the same branch, the comments of earlier rounds show with an **Open** or **Resolved** switch; a status change goes with the next submit. A comment whose element is gone, such as a comment on a deleted method, shows under **Unanchored**.
- **Keyboard and themes:** every container header, card and arrow label takes the focus with Tab, in the order container, then its cards. The page follows the light or dark theme of the system; every state has a text badge, not only a color.

When the analysis turn ends with no accepted model, the status clears and a toast says why, for example `visual-review: the design analysis failed: the turn was interrupted with no design model. Run /visual-review again.`

## 🚀 Install

At the Claude Code prompt:

```text
/plugin install visual-review --marketplace dougcunha/claude-mods
```

Answer `y` to add the marketplace and choose a scope. If you already added the marketplace:

```text
/plugin install visual-review@claude-mods
```

The interactive page needs [Node.js](https://nodejs.org) on the `PATH`. The mod installs no package. Without Node.js, the mod opens a static page with the same diagram, and you send the review with **Copy review**.

## 🎮 Use

| Command | Base |
| --- | --- |
| `/visual-review` | The merge-base of `HEAD` and the main branch: the target of `origin/HEAD`, else `main`, else `master` |
| `/visual-review <ref>` | Any Git reference, for example `HEAD~3` or `release/2.0` |

The changes are the committed, staged, unstaged and untracked (not ignored) files against the base. The command waits until the current turn ends, and it never runs by itself.

The command stops with a message when:

- the folder is not in a Git repository: `visual-review needs a Git repository.`
- there is nothing to compare: `No changes against <base>.`
- the reference does not exist: `Unknown Git reference: <ref>.`
- no main branch exists, or `HEAD` has no common commit with it: name a base with `/visual-review <ref>`.

## 🔧 Settings

Set them in `/config`, under the mod's name.

| Option | Default | What it does |
| --- | --- | --- |
| `analysisModel` | `sonnet` | The model of the subagent that reads the diff and returns the design model: `sonnet`, `opus`, `haiku`, or `inherit` for the model of the session. |

## 🚧 Limitations

- **Cost:** each run starts 1 subagent that reads the diff and the files around it. Nothing starts an analysis but the command.
- **The tool loads on demand:** `submit_model` waits behind ToolSearch, so it costs no context until a run asks the subagent to load it.
- **One run at a time:** a new `/visual-review` replaces the run that waits; the subagent of the old run gets a result that tells it to stop. `/clear` cancels the run that waits.
- **Node.js:** the interactive page needs `node` on the `PATH`. Without it, or when the server stops before it gives its link, the page is static: the same diagram and comment forms, but no **Submit review**. **Copy review** copies the review text, and you paste it in the prompt. The static page keeps its comments only in that browser, does not update when you run `/visual-review` again (each run opens a new page), and does not send status changes to the mod's store.
- **Local and private page:** the server listens on `127.0.0.1` only, on a free port, and answers only a request that carries the secret token of the link and the `Host` `127.0.0.1:<port>`; any other request gets HTTP 403. The page loads nothing from the internet. The link goes to you in the toast, never to the model.
- **Server lifetime:** the server runs while the session runs. `/clear`, the end of the session and `/reload-plugins` stop it within a second; the next run starts a new one and opens a new tab.
- **Large changes:** the layout of 100 units and 30 tables takes about 1 s on a desktop computer. Many relations across containers make a wide diagram; close containers or filter to units or tables to read it.
- **Stored comments:** the comments live in the mod's store of Claude Code, under 1 key per repository and branch, so they survive a closed tab, `/clear` and a restart. When the mod's keys pass 3 MiB, the review with the oldest change goes first. Uninstalling the mod leaves the keys; they do nothing without it.
- **Model text on disk:** `view.json` (and `view.js` for the static page) holds the unit summaries and cohesion reasons of the analysis, in the session's temporary folder only. The page needs them, and the system cleans the folder; the mod has no way to delete a file.
- **Exact numbers, limited by the ranges:** the line counts come from Git, so 2 runs over the same diff give the same file totals, and 2 runs over the same design model the same unit deltas, Ce and Ca. A unit's delta is only as right as the line range the analysis gave it; a range whose first lines do not hold the unit name is sent back as a gap. A diff larger than 4 MiB leaves every unit delta unknown and keeps the file totals.
- **Platforms:** tested on Windows 11 with Chrome and Chromium. The browser launch on macOS (`open`) and Linux (`xdg-open`) is not tested yet.
- **Read-only Git:** the mod runs only read-only Git commands, with the repository root as the working folder. Each untracked file costs 1 `git diff --no-index` run, so its line counts come from Git like the tracked files.

## 🔨 Development

```text
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

<details>
<summary>🗂 Source files</summary>

| File | Role |
| --- | --- |
| `hooks/register.tsx` | The command and the tool, the `command.run`, `tool.call`, `turn.start` and `turn.complete` hooks |
| `hooks/git.ts` | The repository, the base, the changed files and their parsers |
| `hooks/model.ts` | The `submit_model` schema, the narrowing of its input, and the coverage, id and range checks |
| `hooks/metrics.ts` | Unit line deltas from the hunks, the lines outside the units, Ce and Ca |
| `hooks/view.ts` | The view model: cards, containers, relations, tables, entity links and other files, and its file |
| `hooks/prompts.ts` | The analysis prompt, the review prompt, the tool description, and the results and toasts the mod sends |
| `hooks/comments.ts` | The comment store: key, narrowing, merge, rounds, anchors and pruning |
| `hooks/server.ts` | The server and browser argv, the line buffer and the parser of the server's lines, the page mode, and the static page |
| `server/server.mjs` | The page server: Node.js built-ins only, token and `Host` checks, the view model and its updates |
| `web/` | The page; `web/review-text.js` builds the text of **Copy review**, the same as the review prompt |
| `hooks/paths.ts` | Path helpers that normalize separators, and the session folder |
| `hooks/host.ts` | The engine calls the helper modules use |
| `types/index.d.ts` | The `$.state` contract |

</details>

## 📄 License

[MIT](../LICENSE). The page ships [elkjs](https://github.com/kieler/elkjs) 0.9.3 (`web/vendor/elk.bundled.js`), the Eclipse Layout Kernel, under the [EPL-2.0](web/vendor/ELK-LICENSE.md).
