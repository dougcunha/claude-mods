# Autonomous decisions — prd-01-visual-review

## AUTO-01 — HIL 1 (PRD) — 2026-10-22 11:48

- Question: Approve `prd.md` as the product contract for `visual-review`?
- Options: A (recommended) — approve the current PRD and start from the approved plan; B — reopen the PRD.
- Choice: A
- Reason: The coverage gate of `prd.md#PRD acceptance gate` passes; `techspec.md#Sources and traceability` and `context-snapshot.md` O-04 say the user approved it on 2026-10-22. Agent text does not create authorization, so this record backs the approval under the auto mode (W-01).
- Reversal: Set the checkpoint phase to `product` and rerun `sdd-create-prd`; cost: replan T01–T07.

## AUTO-02 — HIL 2 (TechSpec and plan) — 2026-10-22 11:48

- Question: Approve `techspec.md`, `tasks.md` and `task_01.md`–`task_07.md`, authorize implementation and corrections within that contract, and decide if QA runs?
- Options: A (recommended) — approve, authorize, and enable QA; B — approve without QA.
- Choice: A
- Reason: `tasks.md#Coverage gate` passes; preparatory refactoring is not recommended (`techspec.md#Terrain baseline`). QA runs because the TechSpec has manual cases TC-18, TC-19 and a real-session acceptance script (`techspec.md#Test approach`).
- Reversal: Set the checkpoint phase to `plan-project`; cost: rework of tasks not yet done.

## AUTO-03 — ContextBrake check — 2026-10-22 11:48

- Question: Does `context-brake.config.json` support an autonomous run?
- Options: A — yes, no warning; B — warn and suggest `npx context-brake init`.
- Choice: A
- Reason: `activeHarnesses` has `claude-code`; `autoRestart.maxConsecutiveRestarts` is 10; `snapshot.command` is `sdd-snapshot`; `snapshot.resumeCommand` is `sdd-orchestrate-flow`.
- Reversal: Not applicable.

## AUTO-04 — T01 / sdd-execute-task — 2026-10-22 12:05

- Question: Create `hooks/paths.ts` in T01, though the task's affected files leave it out?
- Options: A (recommended) — create it with `norm` only; B — normalize paths inside `git.ts`.
- Choice: A
- Reason: `.agents/rules/mod-runtime.md#Files` requires path helpers in `hooks/paths.ts`; `techspec.md#Relevant files` lists it.
- Reversal: Inline `norm` into `git.ts`; cost: 1 file.

## AUTO-05 — T01 / sdd-execute-task — 2026-10-22 12:05

- Question: What does the command answer when no main branch exists, `HEAD` has no common commit with it, or `git diff` fails? The PRD lists no text for these cases.
- Options: A (recommended) — stop with a short cause and ask for a base (`/visual-review <ref>`); B — fall back to `HEAD` as the base.
- Choice: A
- Reason: FR-02 names only `origin/HEAD`, `main` and `master`; a silent fallback to `HEAD` would hide committed work. A stop is the smallest and most reversible choice and matches FR-04 (message, no prompt).
- Reversal: Change `commandText` and `defaultBase` in `visual-review/hooks/git.ts`; cost: 1 test.

## AUTO-06 — T01 / sdd-execute-task — 2026-10-22 12:05

- Question: The engine did not lay the types for the new mod, and the validator refuses a contract file with no exported type. How to run `tsc` and keep a valid `types/index.d.ts`?
- Options: A (recommended) — copy the engine-written types folder of `session-info` (2.1.301, the version the TechSpec cites, ignored by its own `.gitignore`) and declare the `pendingRun` key of the TechSpec now; B — skip `tsc` and keep an empty contract.
- Choice: A
- Reason: `techspec.md#Contracts and data` defines `pendingRun`; `.agents/rules/javascript-typescript.md#Types` asks for `tsc` before a commit.
- Reversal: Delete `visual-review/.claude-plugin/types/` (not versioned); cost: none.

## AUTO-07 — T02 / sdd-execute-task — 2026-10-22 12:20

- Question: The engine refuses `$.prompt.submit` inside the `command.run` hook. How does the command start the analysis?
- Options: A (recommended) — submit from `$.clock.after(0)`, after the hook answered; B — put the analysis prompt in the command's `context`, which does not start a turn.
- Choice: A
- Reason: The engine error names a later event as the fix; DEC-01 needs the prompt as a turn of its own; `mod-hooks.md#Registration and lifetime` names `$.clock.after` for work that outlives a dispatch. The real run in T02 confirmed it.
- Reversal: Move the submit back into the hook if a later engine allows it; cost: 1 function.

## AUTO-08 — T02 / sdd-execute-task — 2026-10-22 12:20

- Question: T02.3 lists `submit`, `status` and `toast` as new `Host` members, and DEC-08 asks for a name check on every range. Follow both literally?
- Options: A (recommended) — add only `readFile` to `Host`, and skip the name check for a `module` unit; B — add unused members and check module names.
- Choice: A
- Reason: `code-standards.md#Modules and size`: a Host member exists for an engine call a helper needs; only `checkRanges` needs one. FR-07 and the analysis prompt name a module after its file, so its text need not hold the name.
- Reversal: Add the members when a helper needs them; check module ranges by file name; cost: small.

## AUTO-09 — T03 / sdd-execute-task — 2026-10-22 12:45

- Question: How does T03 read the hunks so that paths match `--numstat -z`, and how are nested units counted?
- Options: A (recommended) — run `git -c core.quotePath=false diff -U0 --no-color -M <base>` and count each unit's own range, with the rest as the lines outside every range; B — run the TechSpec command as written and split nested ranges.
- Choice: A
- Reason: Without `core.quotePath=false`, Git writes a non-ASCII name with octal escapes, so it would not match the `-z` path (real sample in `tests/git.test.ts`). FR-10 states the sum rule for units side by side; the TechSpec does not define nesting, and counting each range as given keeps the card true to its unit.
- Reversal: Drop the `-c` override in `diffHunks`, or subtract nested ranges in `unitDelta`; cost: 1 function and its tests.

## AUTO-10 — T04 / sdd-execute-task — 2026-10-22 13:00

- Question: How does the mod open the browser on Windows, stop the server at `session.end`, and know if a tab is open?
- Options: A (recommended) — `rundll32 url.dll,FileProtocolHandler <url>`, a `tick` line each second so the read loop can break, and a `clients` line with the count of open event streams; B — `explorer.exe <url>` as in `session-info`, and stop only at module unload.
- Choice: A
- Reason: In the real run, `explorer.exe` opened File Explorer for the token URL and no tab connected; `rundll32` opened the browser and the tab connected (`clients: 1`). The engine stops a spawned child only when its loop leaves (`index.d.ts`, `process.spawn`), and the loop wakes only on a chunk; DEC-02 and NFR-06 need the server to end with the session. FR-21 needs a new tab only when none is open.
- Reversal: Change `browserArgv` and the server lines; cost: small.

## AUTO-11 — T07 / sdd-execute-task — 2026-10-22 13:26

- Question: The static page has no way back to the mod, so where does the text of "Copy review" come from, while it must equal the review prompt of `hooks/prompts.ts` (T07.3) and the page must not hold logic without a test (DEC-07)?
- Options: A (recommended) — a classic script `web/review-text.js` (no import or export, sets `globalThis.reviewText`) that the page loads, and a kit test that imports it and asserts the same text as `reviewPrompt` on the TC-13 inputs; B — duplicate the formatter inside `app.js` with only a manual check; C — the mod writes a text template into `view.js`.
- Choice: A
- Reason: The reviewer writes the comments in the static page, so the page must format them (FR-24). A keeps the formatter out of `app.js` and gives it an automated equality test (DEC-07, `tests.md` "Agent-facing text"); C still needs the grouping logic in the page; B has no test.
- Reversal: Inline the function into `app.js` and delete the file and its test; cost: small.

## AUTO-12 — T07 / sdd-execute-task — 2026-10-22 13:26

- Question: Six untracked `.js` files (`hooks/git.js`, `host.js`, `paths.js`, `register.js`, `tests/git.test.js`, `tests/visual-review.test.js`, all 11:57) are old compiler output of a T01 `tsc` run before the engine types with `noEmit` were in place. Keep or delete them?
- Options: A (recommended) — delete them; B — keep them.
- Choice: A
- Reason: They are generated by this feature's own session, are not in the TechSpec file list, are stale copies of the `.ts` sources, and would enter the commit with the untracked `visual-review/` folder. `tsc -p visual-review` with `noEmit` does not write them again.
- Reversal: Run `tsc` without `noEmit`; cost: none (the sources are the `.ts` files).

## AUTO-13 — T07 / sdd-execute-task — 2026-10-22 13:45

- Question: T07.6 needs a C#/EF Core, a TypeScript and a Python repository that the user supplies or approves, and the desktop app. No user follows this run. Escalate now, or gather the evidence the session can make?
- Options: A (recommended) — build small sample repositories in the scratchpad (C# with an EF Core migration and DbContext; Python with SQLAlchemy and an Alembic migration), run `/visual-review` in a real headless session on each, reuse the TypeScript sample of T04 for the static run, and keep the user's approval of the samples, the desktop app and macOS/Linux as pending manual acceptance for HIL 3; B — escalate before the review.
- Choice: A
- Reason: The escalation rubric applies only when no other eligible unit remains; the global review is still eligible. The samples give real evidence for OBJ-01 and FR-14 now, and the user's approval stays open, as the T05 visual check did.
- Reversal: Replace the samples with the user's repositories and run the manual script again; cost: 1 run per stack.

## AUTO-14 — Correction round 1 / sdd-plan-corrections — 2026-10-22 14:15

- Question: How does codereview_01 become correction tasks, and what happens to its block and optional improvements?
- Options: A (recommended) — 10 tasks T08–T17 in `codereview_01/` for CR-01 to CR-11 (CR-05 and CR-06 together in T13); fixes inside the approved contract: an optional `notice` and an `anchors` list added to the view model (T15, T17), an optional `sentStatus` on a stored comment (T12, backward compatible), `pendingRun` unchanged (T10 reads old paths from Git again); the block (T07.6, TC-18/TC-19 manual acceptance) stays pending for HIL 3; the optional improvements O-01 to O-12 stay informational; B — change the TechSpec contracts instead of the code for CR-05, CR-06, CR-08.
- Choice: A
- Reason: The code follows the TechSpec integrations table (CR-05, CR-06) and FR-20 (CR-08); the view model and the stored comment get only optional fields, which DEC-07 and the `$.store` versioning allow. W-04 authorizes corrections within the contract. The block needs the user (escalation rubric: essential manual validation) and does not stop the other units.
- Reversal: Drop the optional fields and their readers; cost: small per task.

## AUTO-15 — Review routing after codereview_02 — 2026-10-22 15:05

- Question: codereview_02 is REJECTED only by the manual-acceptance block (T07.6: the user's approval of the sample repositories, the desktop app, macOS/Linux; TC-18 network capture and session end; TC-19 on real stacks and a second browser; the live comment loop). How does the flow go on?
- Options: A — escalate to the user: accept the block as open manual acceptance and run the delegated QA, or run the manual checks first; B — open correction round 2 (nothing in the block is a code change).
- Choice: Escalated: essential manual validation and the user's approval, with no other eligible unit (QA needs a closed review cycle).
- Reason: Escalation rubric items "depends on an unavailable environment, credential, or essential manual validation, with no other eligible unit" and "changes the approved PRD scope" do not allow an autonomous closing; autonomous-mode.md, Automatic acceptance: a pending essential manual validation prevents completion.
- Reversal: none needed; the answer is recorded in workflow.md.

## AUTO-16 — HIL 3 after qa_01 — 2026-10-22 15:35

- Question: qa_01 is BLOCKED only by the manual acceptance the user owns (W-05): TC-19 on real stacks and a second browser, the hand-driven page loop and the Copy review clipboard, the full keyboard walk and contrast, the desktop app, macOS/Linux, and the approval of the sample repositories. Accept the delivery?
- Options: A — run the manual script, then accept; B — accept now with these items as accepted open items; C — stop.
- Choice: Escalated: autonomous-mode.md, Automatic acceptance: a QA report that is not APPROVED and an essential manual validation that is open prevent automatic acceptance; HIL 3 goes to the user with the manual script.
- Reason: qa_01 status BLOCKED; review codereview_02 REJECTED only by the same block; W-05.
- Reversal: none needed.
