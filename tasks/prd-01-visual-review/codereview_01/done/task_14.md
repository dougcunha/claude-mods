# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T14 — Tests for the tool failure path, the model option and the tool spec

## Outcome

The suite fails if the `tool.call` `.catch` stops answering, if `analysisModel` stops reaching the prompt through `register`, if the tool description or schema changes, or if `haiku` gives another agent line.

## Dependencies and boundaries

- Depends on: T13
- Unblocks: —
- In scope: tests only.
- Out of scope: code changes (a test that fails because of a defect stops the task as a new finding).

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-11 | `codereview.md#Findings` | 4 missing tests required by `tests.md` |

## Requirements

- `tests.md` required scenarios: a gating hook does what its `.catch` says; agent-facing text is asserted exactly and changes only with its option; a test that depends on a default says so.

## Context to recover on demand

- Rules: `tests.md`; skill `ts-tests` for the count.
- Code: `register.tsx` (`tool.call` `.catch`, `analysisModelOf(options)`), `tests/visual-review.test.ts` TC-01, `tests/prompts.test.ts`.

## Work

- [x] T14.1 Kit: a `tool.call` whose work fails (for example `$.state` read fails) answers `visual-review failed: <cause>` and never denies.
- [x] T14.2 Kit with `options: { analysisModel: 'opus' }`: the analysis prompt names `model opus`; the default test says it uses the default `sonnet`.
- [x] T14.3 TC-01 asserts the tool description and the `inputSchema` reference (the `SUBMIT_SCHEMA` value).
- [x] T14.4 `haiku` in the analysis prompt test.

## Acceptance criteria

- 4 new or extended tests pass, and each fails when its line is broken on purpose (manual mutant pass, recorded in the handoff).

## Verification

- Unit: T14.4.
- Kit: T14.1 to T14.3.
- Real session: not applicable.
- Manual: the mutant pass.
- Platforms: Windows.
- Environment dependency: none.
- Commands: `claude plugin test visual-review`, `tsc -p visual-review`.
- Expected evidence: test count and exit code 0; mutant results.

## Affected files

- Modify: `visual-review/tests/visual-review.test.ts`, `visual-review/tests/prompts.test.ts`

## Observability and recovery

- Operational signal: none.
- Recovery: none needed.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: 4 tests. Kit: a `submit_model` call whose file write fails gets `visual-review failed: <cause>` as its result (world option `isWriteFailing`); with `options: { analysisModel: 'opus' }` the analysis prompt names `model opus`, and the default test now says and asserts `model sonnet`; TC-01 asserts the exact tool description and `inputSchema: SUBMIT_SCHEMA`. Unit: `haiku` in the agent-line test of the analysis prompt.
- Changed files: `visual-review/tests/visual-review.test.ts`, `visual-review/tests/prompts.test.ts`.
- Checks: `claude plugin test visual-review`: 107 pass, 0 fail; `tsc -p visual-review`: exit 0; `claude plugin validate visual-review`: passed. Mutant pass (4 mutants at once, then restored with `cmp`): `.catch` result text changed → the failing-work test fails; `analysisModelOf(undefined)` → the option test fails; a word removed from the tool description → TC-01 (both surfaces) and the TC-13 description test fail; `haiku` printed as `sonnet` → the TC-13 agent-line test fails. 6 fails, 101 pass under the mutants.
- Validated state: base `8d5ddeb` plus the T01–T14 diff; Windows 11, Claude Code 2.1.308.
- Open items: none.
