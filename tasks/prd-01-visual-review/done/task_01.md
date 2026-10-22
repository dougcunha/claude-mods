# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/prd.md`
2. `tasks/prd-01-visual-review/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T01 — Command, base and changed files

## Outcome

The `visual-review` mod installs from the folder marketplace. `/visual-review [base]` resolves the base, collects the changed and untracked files with their line counts, and answers in the session: the error text for each error case, or a 1-line summary (`<n> files changed against <base label>`) on success. The success summary is temporary; T02 replaces it with the analysis.

## Dependencies and boundaries

- Depends on: —
- Unblocks: T02
- In scope: mod skeleton, `Host`, Git collection and parsing, command registration and error answers, marketplace and root README rows, mod README with the Install section.
- Out of scope: the analysis prompt, the tool, hunks per unit (T03 reads `-U0`), the server, the page.

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-01, FR-02, FR-03, FR-04 | `prd.md#functional-requirements` | Command, default base, base argument, error cases |
| NFR-10 | `prd.md#non-functional-requirements` | No automatic run |
| DEC-10 | `techspec.md#technical-decisions` | Command not `immediate` |
| CMP-02, CMP-03, CMP-12, CMP-13 | `techspec.md#components-and-flow` | `host.ts`, `git.ts`, manifest, marketplace |
| TC-01, TC-02, TC-03, TC-04 | `techspec.md#test-approach` | Registration, base, errors, parsers |

## Context to recover on demand

- Applicable skills and rules: `AGENTS.md`; `.agents/rules/mod-hooks.md`, `mod-runtime.md`, `code-standards.md`, `javascript-typescript.md`, `tests.md`; skill `ts-tests`.
- Existing code: `session-info/hooks/register.tsx:991-1032` (registration in `session.start`), `session-info/hooks/host.ts` (Host shape), `session-info/hooks/git.ts:50` (temp folder), `session-info/.claude-plugin/plugin.json` (manifest shape), `session-info/tsconfig.json`, `session-info/hooks/hooks.json`.
- Contract or integration: `techspec.md#integrations-and-interfaces` (Git commands 1–4), `techspec.md#contracts-and-data` (Command, `userConfig`).
- Engine reference: `$.command.register`, `CommandSpec`, `command.run`, `CommandRunResult`, `$.process.run`, `ProcessRunResult.isStdoutTruncated`.

## Work

- [x] T01.1 Create `visual-review/.claude-plugin/plugin.json` (version `0.1.0`, `userConfig.analysisModel` with options and default `sonnet`), `hooks/hooks.json`, `tsconfig.json`, `types/index.d.ts` (empty state for now).
- [x] T01.2 Create `hooks/host.ts` with the members this task needs (`run`, `cwd`).
- [x] T01.3 Create `hooks/git.ts`: repository root, branch, main branch, base, `--numstat -z -M` parser (renames, binary `-`), untracked list, line count of an untracked file.
- [x] T01.4 Create `hooks/register.tsx`: register the command in `session.start`; `command.run` with `.catch` that answers `{ text }`.
- [x] T01.5 Add the mod to `.claude-plugin/marketplace.json` and the Mods table of the root `README.md`; create `visual-review/README.md` with the Install section and the Node.js note.
- [x] T01.6 Write `tests/git.test.ts` (TC-02, TC-04) with real `git` output samples and `tests/visual-review.test.ts` (TC-01, TC-03).

## Acceptance criteria

- The command shows in the menu with its description and `[base]` hint, and is not `immediate`.
- Outside a repository, with an empty diff, and with an unknown reference, the command answers the PRD text and calls no `prompt.submit`.
- An untracked file shows as added with its line count; a rename shows once with the new path.

## Verification

- Unit: TC-02, TC-04 in `tests/git.test.ts`.
- Kit: TC-01, TC-03 in `tests/visual-review.test.ts` on `terminal` and `desktop`, with a fake `run` that follows `ProcessRunResult`.
- Real session: load the mod from the folder marketplace, `/reload-plugins`, run `/visual-review` and `/visual-review nope` in this repository.
- Manual: not applicable.
- Platforms: Windows.
- Commands: `claude plugin validate .`, `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Environment dependency: none.
- Expected evidence: test count and exit code 0; the command text in the session.

## Affected files

- Modify: `.claude-plugin/marketplace.json`, `README.md`
- Create: `visual-review/.claude-plugin/plugin.json`, `visual-review/hooks/hooks.json`, `visual-review/hooks/register.tsx`, `visual-review/hooks/host.ts`, `visual-review/hooks/git.ts`, `visual-review/types/index.d.ts`, `visual-review/tsconfig.json`, `visual-review/README.md`, `visual-review/tests/git.test.ts`, `visual-review/tests/visual-review.test.ts`

## Observability and recovery

- Operational signal: the command answer text.
- Recovery: remove the mod folder and the 2 rows.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: `/visual-review [base]` registers in `session.start` (not `immediate`), resolves the base (merge-base with the target of `origin/HEAD`, else `main`, else `master`, or a named reference), collects the changed files with `--numstat -z -M` and the untracked files with Git line counts, and answers the PRD text for each stop or `<n> files changed against <base label>`.
- Changed files: created `visual-review/.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.tsx`, `hooks/host.ts`, `hooks/git.ts`, `hooks/paths.ts`, `types/index.d.ts`, `tsconfig.json`, `README.md`, `tests/git.test.ts`, `tests/visual-review.test.ts`; modified `.claude-plugin/marketplace.json`, `README.md` (root).
- Checks:
  - `claude plugin validate .`: passed.
  - `claude plugin validate visual-review`: passed; `command.run` listed as a gating hook with `.catch`; only the plugin-directory icon warning (not a repository rule).
  - `claude plugin test visual-review`: 17 pass, 0 fail, exit 0.
  - `tsc -p visual-review`: exit 0.
  - Manual mutant pass on `git.ts` (Critical: parser and processes): `diff.exitCode <= 1` to `=== 0` failed TC-02; removing the leading-dash guard failed FR-03; both reverted (`grep` shows no mutant left).
  - Real session (stream-json headless, mod installed from the folder marketplace with `--scope local`): `/visual-review nope` answered `visual-review: Unknown Git reference: nope.`; `/visual-review` answered `visual-review: 35 files changed against origin/main`. A plain `claude -p "/visual-review"` sends the text to the model, because the command registers in `session.start` after the first prompt is read; a later prompt runs it.
  - Quality profile: QA-01 to QA-06 no hit. QA-07 2 reservation hits, both in tests: `tests/visual-review.test.ts:30` (a throw inside the fake Git, not a hook path) and `tests/visual-review.test.ts:60` (a `for` destructuring that the 4-parameter pattern matches).
- Validated state: worktree at base `8d5ddeb` plus this diff; Windows 11, Claude Code 2.1.308, Git for Windows, terminal surface for the real run; kit tests on `terminal` and `desktop`.
- Open items:
  - The engine did not lay `.claude-plugin/types/` for this mod (it also did not rewrite the 2.1.301 types of `session-info` under 2.1.308). The types folder was copied from `session-info` (engine-written, ignored by its own `.gitignore`) so `tsc` runs. AUTO-06.
  - `types/index.d.ts` declares `pendingRun` now: the validator refuses a contract file that exports no type, and the TechSpec already defines the key. T02 uses it. AUTO-06.
  - `hooks/paths.ts` (only `norm`) is created here though the task list left it out; `mod-runtime.md` requires path helpers there and the TechSpec lists it. AUTO-04.
  - New stop texts that the PRD does not list: no main branch, no common commit, and a failed `git diff`. AUTO-05.
  - The engine shows a command answer under the mod's name (`visual-review: ...`), so the not-a-repository text reads `visual-review: visual-review needs a Git repository.` in the transcript. The text follows the PRD; the review can decide.

### ADR candidates

None - direct TechSpec implementation or local decision.
