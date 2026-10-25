# Stable execution context

Load in this exact order:

1. `tasks/prd-02-feature-progress/prd.md`
2. `tasks/prd-02-feature-progress/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T09 — Accept the mod in a real session

## Outcome

A real Claude Code session with the mod installed from the folder marketplace confirms the band and pane through a small SDD flow, the reload after `/clear` and `/resume`, Refresh across 2 sessions, and a skill run without the mod. The README states the tested Claude Code version and shows a cropped screenshot of the band and the pane.

## Dependencies and boundaries

- Depends on: T06, T07, T10, T11
- Unblocks: —
- In scope: the manual scripts TC-22 … TC-25 and TC-27, a `claude --debug` check for refused renders, the tested-version badge, screenshots in `feature-progress/images/`, fixes of small defects found (or a recorded open item for larger ones).
- Out of scope: new behavior; runs on macOS and Linux.

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| OBJ-01, OBJ-03, OBJ-04 | `prd.md#outcomes-and-metrics` | Real flow, session boundaries, skills without the mod |
| US-05, US-06 | `prd.md#stories-and-journeys` | `/clear`, Refresh across sessions |
| FR-20 | `prd.md#functional-requirements` | Mapping order in a real run |
| DEC-09 | `techspec.md#technical-decisions` | Reload after the switch (not reproducible in the kit) |
| TC-22 … TC-25 | `techspec.md#test-approach` | Manual acceptance |
| FR-22, TC-27 | `prd.md#functional-requirements`, `techspec.md#test-approach` | Hidden band in a real session (W-09) |

## Context to recover on demand

- Applicable skills and rules: `.agents/rules/tests.md` (real session), `.agents/rules/pane-ui.md` (screenshots, `claude --debug`); memory notes on plugin install scope and the org policy that skips `classic.*` hooks.
- Existing code: `feature-progress/README.md` (examples to follow).
- Contract or integration: `techspec.md#test-approach` (manual rows).
- Engine reference: not applicable.

## Work

- [x] T09.1 Install the mod from the folder marketplace with `--scope user`; run `claude --debug` and confirm no `ui.render ... refused`.
- [x] T09.2 TC-22: run `sdd-orchestrate-flow` on a small feature with one review round; record the band and pane states in order.
- [x] T09.3 TC-23: `/clear` and `/resume` after reports; the band and pane come back without a new report.
- [x] T09.4 TC-24: report in one session, Refresh in a second session on the same repository.
- [x] T09.5 TC-25: disable the mod and run a skill with a report step; it completes with no error and no extra question.
- [x] T09.7 TC-27: with an open feature, run `/feature-progress band`, `/clear`, then `/feature-progress band` again; the band hides, stays hidden after `/clear`, and comes back; `/config` shows `showBand`; `/feature-progress` opens the pane while the band is hidden.
- [x] T09.6 Update the README badge with `claude --version`, add cropped screenshots of the T11 drawing, bump `version` if user-facing text changed. Badge checked (2.1.310); debug run and screenshots of 0.3.0 done in codereview_01/task_12.

## Acceptance criteria

- TC-22 shows planning → active → review #1 → fixing #1 → review #2 → waiting → done, with correction tasks under "Review #1".
- TC-23 and TC-24 behave as the TechSpec rows say.
- TC-25 completes with no error.
- TC-27 behaves as the TechSpec row says.
- The README badge matches the version used.

## Verification

- Unit: not applicable.
- Kit: not applicable.
- Real session: TC-22 … TC-25 and TC-27 as above.
- Manual: the user runs `/clear`, `/resume` and the second session; owner: user with this session.
- Platforms: Windows.
- Commands: `claude --version`, `claude plugin validate feature-progress`, `claude plugin test feature-progress`.
- Environment dependency: a real session with the mod installed; the user's hands for the session steps.
- Expected evidence: a short log of observed states per TC in the handoff; screenshots in `feature-progress/images/`.

## Affected files

- Modify: `feature-progress/README.md`, `feature-progress/.claude-plugin/plugin.json` (version, only if needed)
- Create: `feature-progress/images/*.png`

## Observability and recovery

- Operational signal: `claude --debug` output for refused renders.
- Recovery: uninstall the mod.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: the user ran the acceptance in a real session, with a large feature in another repository, and reported it as OK (W-10, 2026-10-25). T09.6 was closed later by codereview_01/task_12 and codereview_02/task_19, with screenshots of the T11 drawing.
- Changed files: none; the README badge already says 2.1.310, the version `claude --version` prints.
- Checks: TC-22 … TC-25 and TC-27 passed, as the user reported; no per-TC log was sent.
- Validated state: the user's session on Windows, Claude Code 2.1.310, mod installed from the folder marketplace, version 0.2.0 at the time of TC-22 … TC-27; T11 (0.3.0) came after it.
- Open items: band screenshot added later by codereview_02/task_19 (`feature-progress/images/band.png`); before it, no band screenshot (see codereview_01/done/task_12.md handoff). T09.6 closed by codereview_01/task_12: the user ran version 0.3.0 in a real session (W-13, 2026-10-25) and reported `claude --debug` with no `ui.render ... refused`, the `nerd` glyphs and `paneBackground` as OK; screenshots of the pane with `unicode` (with `✕`), `nerd` and `emoji` are in `feature-progress/images/` and the README.

### ADR candidates

None - manual acceptance; no new decision.
