# claude-mods

Mods for [Claude Code](https://claude.com/claude-code): panes, slash commands and hooks built with the plugin function-hooks API. Each mod lives in its own folder, and this repository is also a plugin marketplace, so every mod installs with one `/plugin` command.

## Mods

| Mod | What it does | Command |
| --- | --- | --- |
| [session-changes](session-changes/) | Treeview pane of the files the current session created, modified or deleted. Pressing a new file opens it in your editor; pressing a changed or deleted one opens its diff. | `/changes` |

## Install

Run these at the Claude Code prompt in a terminal session.

Install one mod directly from this repository:

```text
/plugin install session-changes --marketplace dougcunha/claude-mods
```

Answer `y` to add the marketplace, then pick a scope (user scope loads the mod in every session).

Or add the marketplace once and install mods from it by name:

```text
/plugin marketplace add dougcunha/claude-mods
/plugin install session-changes@claude-mods
```

To get new versions later:

```text
/plugin marketplace update claude-mods
```

## Requirements

- Claude Code with function-hooks plugin support. These mods were built and tested on Claude Code 2.1.296. The API is early access and may change between releases.
- Some mods call external tools. Each mod's README lists what it needs.

## Developing a mod

Each mod is a folder with three parts:

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

To add a mod to the marketplace, add an entry to [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) and a row to the table above.

## License

[MIT](LICENSE)
