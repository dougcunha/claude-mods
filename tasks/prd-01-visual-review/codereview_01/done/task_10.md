# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T10 — The base range of a renamed file is checked

## Outcome

For a renamed file, the base side of the range check reads the file at its old path. A base file that does not exist at the base gives a gap, not "range not checked"; only a file Git cannot show in full (above the output limit) stays unchecked.

## Dependencies and boundaries

- Depends on: T09
- Unblocks: —
- In scope: `checkRanges` and `baseText` in `hooks/model.ts`; the old paths given by `register.tsx` from `changedFiles`.
- Out of scope: the current-side read (a missing current file stays unchecked: `Host.readFile` does not tell missing from too large); the `$.state` contract (`pendingRun.files` keeps its shape).

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-04 | `codereview.md#Findings` | `git show <base>:<new path>` fails for a rename, so `baseRange` is never checked |

## Requirements

- DEC-08: the base range of a modified unit and the range of a deleted unit are checked in the base file.
- TechSpec "Errors and edges": only a file that cannot be read in full skips the check.

## Context to recover on demand

- TechSpec: `#technical-decisions` (DEC-08), `#errors-security-and-recovery`.
- Code: `hooks/model.ts:checkRanges`, `baseText`, `RangeSource`; `hooks/git.ts:changedFiles` (`oldPath`); `register.tsx:submitModel`.

## Work

- [x] T10.1 `RangeSource` gets `oldPaths` (current path to base path); `baseText` uses the old path when there is one.
- [x] T10.2 `baseText` tells "not in the base" (exit code not 0) from "cut" (truncated): the first is a gap that names the file, the second stays unchecked.
- [x] T10.3 `register.tsx` gives the old paths from `changedFiles` of the run.
- [x] T10.4 Unit tests: a renamed modified unit is checked at its old path (pass and gap); a base file missing at the base is a gap; a truncated base file is unchecked.

## Acceptance criteria

- A wrong `baseRange` on a renamed file is sent back as a gap.
- The suite passes, and the existing DEC-08 tests keep their results.

## Verification

- Unit: the 3 cases in `tests/model.test.ts`.
- Kit: the TC-06 kit tests still pass.
- Real session: not applicable.
- Manual: not applicable.
- Platforms: Windows.
- Environment dependency: none.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Expected evidence: test count and exit code 0.

## Affected files

- Modify: `visual-review/hooks/model.ts`, `visual-review/hooks/register.tsx`, `visual-review/tests/model.test.ts`

## Observability and recovery

- Operational signal: the gap text in the tool result.
- Recovery: revert the 2 functions.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: `RangeSource.oldPaths` maps a current path to its base path; `baseText` runs `git show <base>:<old path>` for a renamed file. A `git show` that exits with another code than 0 is a gap (`<unit>: the base file <path> is not in the base commit; use the state added for a unit of a new file`); a Git that cannot run, or output cut at its limit, leaves the unit unchecked. `submitModel` reads the renames again with `changedFiles` (the `$.state` contract keeps only paths). The same gap is not listed twice.
- Changed files: `visual-review/hooks/model.ts`, `visual-review/hooks/register.tsx`, `visual-review/tests/model.test.ts`.
- Checks: 2 new unit tests (a renamed modified unit passes at its old path, a wrong base range there is a gap, every `git show` names the old path; a base file missing at the base is a gap and a cut one is unchecked); the existing DEC-08 tests keep their results. `claude plugin validate visual-review`: passed; `claude plugin test visual-review`: 97 pass, 0 fail; `tsc -p visual-review`: exit 0.
- Validated state: base `8d5ddeb` plus the T01–T10 diff; Windows 11, Claude Code 2.1.308.
- Open items: a current-side file that cannot be read stays unchecked (`Host.readFile` does not tell a missing file from one above 4 MiB), as the task bounds say.
