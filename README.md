<h1 align="center">🧩 claude-mods</h1>

<p align="center">
  Mods for <a href="https://claude.com/claude-code">Claude Code</a>: panes, slash commands and hooks built with the plugin function-hooks API.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Claude%20Code-2.1.296-d97757.svg" alt="Tested on Claude Code 2.1.296">
  <img src="https://img.shields.io/badge/marketplace-dougcunha%2Fclaude--mods-6e40c9.svg" alt="Marketplace: dougcunha/claude-mods">
</p>

Each mod lives in its own folder, and this repository is also a plugin marketplace, so every mod installs with one `/plugin` command.

## 📦 Mods

| Mod | What it does | Command |
| --- | --- | --- |
| [**session-info**](session-info/) | One pane that shows the state of the session, the repository and the work Claude does. Pressing a new file opens it in your editor; a changed or deleted one opens its diff. | `/session-info`, `/autopick` |
| [**topic-guard**](topic-guard/) | Before a prompt enters the session, a small model judges whether it starts a separate topic. Enter keeps it here; New session clears the session for it. | — |

<p align="center">
  <img src="session-info/images/overview.png" width="480" alt="The session-info pane: cost and elapsed tiles, then the Session, Usage, Autopick, Todos, Last turn, Skills, Agents, Checks and Changes sections">
</p>

The **session-info** pane shows:

- 📊 The context window, cost and turn stats, plus usage and context alerts.
- 🔁 The last turn's result, tokens, cache, tools and refused calls.
- ✅ A task list Claude keeps, like OpenCode's todos.
- ⏱️ An autopick switch that answers a question you left unanswered with its recommended option after a countdown.
- 🧠 The skills in use, and the session's agents with their model and effort.
- 🛰️ The shell commands Claude runs in the background, with their status and run time.
- 🚀 The GitHub Actions runs the session started, and the Jira issues the chat mentions.
- 📈 Live plan usage bars, like `/usage`.
- 🧪 The status of the last build and test run, background runs included, with a prompt that asks Claude to fix a failure.
- 🌿 The Git state of the repository and its submodules, with a treeview of its changed files.
- 📝 A treeview of the files the session created, modified or deleted.

## 🚀 Install

Run these at the Claude Code prompt in a terminal session.

Install one mod directly from this repository:

```text
/plugin install session-info --marketplace dougcunha/claude-mods
```

Answer `y` to add the marketplace, then pick a scope (user scope loads the mod in every session).

Or add the marketplace once and install mods from it by name:

```text
/plugin marketplace add dougcunha/claude-mods
/plugin install session-info@claude-mods
```

To get new versions later:

```text
/plugin marketplace update claude-mods
```

## 📋 Requirements

- Claude Code with function-hooks plugin support. These mods were built and tested on Claude Code 2.1.296.
- Some mods call external tools. Each mod's README lists what it needs.

> [!WARNING]
> The function-hooks API is early access and may change between releases.

## 🛠️ Developing a mod

Each mod is a folder with this layout:

```text
<mod>/
├── .claude-plugin/plugin.json   # manifest: name, version, description, userConfig
├── hooks/hooks.json             # { "modules": ["./register.tsx"] }
├── hooks/register.tsx           # export const register: Register = (on, options) => { ... }
├── types/index.d.ts             # $.state contract, when the mod keeps state
└── tests/*.test.ts              # run with `claude plugin test <mod>`
```

Load a mod from a working copy without installing it:

```text
claude --plugin-dir ./<mod>
```

Check it before you commit:

```text
claude plugin validate .            # marketplace and every manifest
claude plugin validate ./<mod>      # one mod's manifest and hooks module
claude plugin test ./<mod>          # the mod's tests
```

> [!TIP]
> To add a mod to the marketplace, add an entry to [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) and a row to the [Mods](#-mods) table.

## 📄 License

[MIT](LICENSE)
