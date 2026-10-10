# Repository Instructions

## Language

- Write all repository text in English: code, UI strings (pane labels, buttons, toasts, command descriptions), comments and READMEs, even when the conversation is in another language.

## Supported API only

- Build mods only on the documented mod API and tool fields: never on members marked `@internal` in the `claude-code` types, undocumented endpoints, or credentials read from disk. When a feature needs anything else, leave it out and say so in the mod's README.
- Known exception, kept by decision: `session-info` reads the `@internal` `bashEditDiff` field to track Bash file changes; do not remove it.

## Adding or changing a mod

- Put each mod in its own top-level folder: `.claude-plugin/plugin.json`, `hooks/`, `tests/*.test.ts`, and a `README.md` with an Install section that uses `/plugin install <mod> --marketplace dougcunha/claude-mods`.
- Register every new mod in `.claude-plugin/marketplace.json` and add its row to the Mods table in the root `README.md`.
- Bump `version` in the mod's `plugin.json` on each user-facing change, so `/plugin marketplace update` delivers it.
- Before committing, run `claude plugin validate .`, `claude plugin validate <mod>` and `claude plugin test <mod>`; all must pass.
- A mod being developed in a live session loads from `~/.claude/dev-mods/<session>/<mod>/`, not from this repo: copy changed files there to see them in that session.
