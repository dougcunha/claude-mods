# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T09 — Unit deltas do not depend on the user's diff prefix settings

## Outcome

With `diff.mnemonicPrefix=true` or `diff.noprefix=true` in the user's Git config, the hunks still match the changed files, so the unit deltas are known.

## Dependencies and boundaries

- Depends on: —
- Unblocks: T10
- In scope: `diffHunks` argv and `parseHunks` prefix handling in `hooks/git.ts`, and the argv in the kit world.
- Out of scope: numstat and ls-files truncation (O-04).

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-03 | `codereview.md#Findings` | `c/` and `w/` headers make every unit delta unknown |

## Requirements

- FR-10, OBJ-04: unit deltas come from Git whatever the user's diff prefix config is.
- Force the prefixes on the command line (`--src-prefix=a/ --dst-prefix=b/`), so the parser strips a known prefix.

## Context to recover on demand

- TechSpec: `#integrations-and-interfaces` (Git command 5).
- Code: `hooks/git.ts:diffHunks`, `sidePath`; `tests/git.test.ts` hunk samples; `tests/visual-review.test.ts` `REPO` key for the `-U0` command.

## Work

- [x] T09.1 Add `--src-prefix=a/` and `--dst-prefix=b/` to the `diffHunks` argv.
- [x] T09.2 Unit test: the argv a fake `Host` receives holds both options; a real sample with a path that starts with `a/` keeps its folder.
- [x] T09.3 Update the kit world key.

## Acceptance criteria

- `git -c diff.mnemonicPrefix=true -c core.quotePath=false diff -U0 --no-color -M --src-prefix=a/ --dst-prefix=b/ <base>` gives `a/` and `b/` headers (checked on this repository).
- The test suite passes.

## Verification

- Unit: argv and the `a/`-folder sample in `tests/git.test.ts`.
- Kit: the existing TC-06 and NFR-04 kit tests with the new argv.
- Real session: not applicable.
- Manual: the `git -c diff.mnemonicPrefix=true` command above; owner: the coordinator session.
- Platforms: Windows.
- Environment dependency: none.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Expected evidence: test count and exit code 0; the header lines of the manual command.

## Affected files

- Modify: `visual-review/hooks/git.ts`, `visual-review/tests/git.test.ts`, `visual-review/tests/visual-review.test.ts`

## Observability and recovery

- Operational signal: none.
- Recovery: revert the argv.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: `diffHunks` runs `git -c core.quotePath=false diff -U0 --no-color -M --src-prefix=a/ --dst-prefix=b/ <base>`; the forced prefixes override `diff.mnemonicPrefix` and `diff.noprefix`, so `sidePath` always strips a known `a/` or `b/`, and a real folder named `a` keeps its name.
- Changed files: `visual-review/hooks/git.ts`, `visual-review/tests/git.test.ts` (new argv and `a/`-folder test), `visual-review/tests/view.test.ts` and `visual-review/tests/visual-review.test.ts` (fake Git keys).
- Checks: on this repository, `git -c diff.mnemonicPrefix=true ... --src-prefix=a/ --dst-prefix=b/` and `git -c diff.noprefix=true ...` both print `--- a/README.md` and `+++ b/README.md`. `claude plugin validate visual-review`: passed (gating hooks with `.catch`); `claude plugin test visual-review`: 95 pass, 0 fail; `tsc -p visual-review`: exit 0.
- Validated state: base `8d5ddeb` plus the T01–T09 diff; Windows 11, Git for Windows 2.x, Claude Code 2.1.308.
- Open items: none.
