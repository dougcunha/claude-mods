# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T12 — A status switched back before a submit is not reported

## Outcome

A comment that goes open, then resolved, then open again before a submit is not in the review prompt's status changes; the server page and the static Copy review give the same text for it.

## Dependencies and boundaries

- Depends on: T11
- Unblocks: T15
- In scope: the status change rule in `hooks/comments.ts` (an optional `sentStatus` field on a stored comment, cleared by `submitRecord`).
- Out of scope: the static page rule, which already compares with the shown status.

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-09 | `codereview.md#Findings` | A status changed and changed back is reported as "Open again" |

## Requirements

- The review prompt lists only the comments whose status differs from the status at the last submit.
- A stored value without the new field reads as before (backward compatible store, `mod-hooks.md` critical area).

## Context to recover on demand

- TechSpec: `$.store` (`Comment`), review prompt text.
- Code: `hooks/comments.ts:mergeComments`, `narrowComment`, `submitRecord`, `reviewOf`.

## Work

- [x] T12.1 On the first status change, keep the status at the last submit; mark the change only while the status differs from it; drop both fields when it is back.
- [x] T12.2 `narrowComment` reads the field; `submitRecord` clears it.
- [x] T12.3 Unit tests: open → resolved → open is not reported; open → resolved is reported once; an old value without the field still narrows.

## Acceptance criteria

- The 3 tests pass, and the TC-11 and TC-13 tests keep their results.

## Verification

- Unit: `tests/comments.test.ts`.
- Kit: TC-14 still passes.
- Real session: not applicable.
- Manual: not applicable.
- Platforms: Windows.
- Environment dependency: none.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Expected evidence: test count and exit code 0.

## Affected files

- Modify: `visual-review/hooks/comments.ts`, `visual-review/tests/comments.test.ts`

## Observability and recovery

- Operational signal: none.
- Recovery: revert the rule; stored values with the field read as before.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: a stored comment can hold `sentStatus`, the status of the last submit, while its status differs from it. `mergeComments` measures a change from `sentStatus` (or the current status the first time): a status back at `sentStatus` drops both `isStatusChanged` and `sentStatus`, so it is not reported. `narrowComment` reads `sentStatus` only when it is `open` or `resolved`; `submitRecord` clears both fields.
- Changed files: `visual-review/hooks/comments.ts`, `visual-review/tests/comments.test.ts`.
- Checks: unit: open → resolved → open reports nothing and stores the plain open comment; open → resolved is reported once and a submit clears the fields; a stored value without `sentStatus`, or with `sentStatus: 'draft'`, still narrows (old shape kept). The TC-11 test now expects `sentStatus: 'open'` on the changed comment. `claude plugin validate visual-review`: passed; `claude plugin test visual-review`: 102 pass, 0 fail; `tsc -p visual-review`: exit 0.
- Validated state: base `8d5ddeb` plus the T01–T12 diff; Windows 11, Claude Code 2.1.308.
- Open items: none.
