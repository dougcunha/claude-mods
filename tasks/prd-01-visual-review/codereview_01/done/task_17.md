# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/codereview_01/codereview.md`
2. This file

Use the already loaded report version; recover relevant contracts and code afterward. This order does not guarantee a host cache hit.

---

# T17 — Restored drafts on the static page are checked against the new model

## Outcome

On the static page, a draft restored from the browser's storage whose element is not in the current model shows under "Unanchored".

## Dependencies and boundaries

- Depends on: T15, T16
- Unblocks: —
- In scope: the anchor list in the view model (`hooks/view.ts`, from `anchorsOf`), and the restore in `web/app.js`.
- Out of scope: server mode (the mod already marks anchors).

## Traceability

| Source | Section | Finding covered |
| --- | --- | --- |
| codereview_01/CR-10 | `codereview.md#Findings` | A restored draft keeps its old `isAnchored` |

## Requirements

- FR-23: a comment whose anchor is not in the model shows in "Unanchored".
- DEC-07: the anchor set comes from the helper module; the page only looks it up.

## Context to recover on demand

- TechSpec: DEC-07, `$.store` anchor ids.
- Code: `hooks/view.ts:anchorsOf`, `buildView`, `withComments`; `web/app.js:withLocal`.

## Work

- [x] T17.1 `ViewModel.anchors: string[]` (`<kind>:<id>`, sorted), set by `buildView` from `anchorsOf`.
- [x] T17.2 `withLocal` sets `isAnchored` of each restored draft from `view.anchors` (`review` is always anchored).
- [x] T17.3 Unit test: the anchor list of a fixture model. Chrome headless probe (as in T07) of a static page whose saved draft names a missing unit: it shows under "Unanchored".

## Acceptance criteria

- The probe shows the draft under "Unanchored"; an anchored draft stays under "This round".

## Verification

- Unit: `tests/view.test.ts`.
- Kit: not applicable.
- Real session: not applicable.
- Manual: Chrome headless probe over `file://` (L-14); owner: the coordinator session.
- Platforms: Windows, Chrome.
- Environment dependency: Chrome.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`, `tsc -p visual-review`.
- Expected evidence: test count and exit code 0; probe output.

## Affected files

- Modify: `visual-review/hooks/view.ts`, `visual-review/web/app.js`, `visual-review/tests/view.test.ts`

## Observability and recovery

- Operational signal: none.
- Recovery: revert the field and the restore rule.

## Handoff

> Updated by `sdd-execute-corrections` during implementation.

- Produced result: the view model has `anchors: string[]`, every anchor of the model as `<kind>:<id>` in text order, built by `buildView` from `anchorsOf` (`anchorKeys`). On the static page, `withLocal` sets `isAnchored` of each restored draft from that list (`review` is always anchored); a view without the list keeps the saved value.
- Changed files: `visual-review/hooks/view.ts`, `visual-review/web/app.js`, `visual-review/tests/view.test.ts`.
- Checks: unit: the C# fixture's anchor list holds a unit, a table and a relation key, has 1 entry per anchor, and is sorted. Chrome 153 headless over `file://` (the T16 model with its anchor list, 2 drafts saved in the browser before the page loads): `Kept` on `unit src/cart.Cart` under "This round", `Gone` on `unit src/gone.Gone` under "Unanchored". The T07 static probe, run again on the current code with a fresh profile: diagram drawn, `Copy review`, 1 comment stored and copied. `claude plugin validate visual-review`: passed; `claude plugin test visual-review`: 109 pass, 0 fail; `tsc -p visual-review`: exit 0.
- Validated state: base `8d5ddeb` plus the T01–T17 diff; Windows 11, Chrome 153.
- Open items: none.
