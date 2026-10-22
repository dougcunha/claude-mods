# PRD — visual-review

## Problem and context

A developer who works with Claude Code gets many changed files at the end of a task. To review the result, the developer reads the diff line by line. The diff shows the implementation. It does not show the design: which classes exist now, how they connect, how large they are, and which database tables changed.

The `visual-review` mod adds the `/visual-review` command. The command opens a page in the browser. The page shows the design of the change as a diagram: units (classes and modules), their relations, their size and quality notes, and the database tables. The reviewer writes comments on the diagram and sends them back to the session in one step.

Users: developers who use Claude Code in C#/.NET, TypeScript/Node or Python repositories and review the work of Claude before they commit or open a pull request.

Source of all decisions in this PRD: the grilling session of 2026-10-22 (questions Q1 to Q16 and the design and viability summary).

## Outcomes and metrics

| ID | Expected outcome | Metric or evidence |
| --- | --- | --- |
| OBJ-01 | The reviewer sees the design of a change without reading the code | Every changed source file of the diff is covered by at least 1 unit, table or "Other files" row on the page |
| OBJ-02 | Review feedback goes back to the session in one action | 1 click on "Submit review" puts all comments in the session as 1 prompt, with no copy and paste (when Node.js is available) |
| OBJ-03 | Feedback stays traceable across review rounds | After a rerun on the same branch, 100% of the comments of the previous round show again with their status |
| OBJ-04 | The numbers on the page are exact | File line counts and file line deltas are identical on 2 runs over the same diff; unit line deltas, Ce and Ca are identical on 2 runs over the same design model |

## Stories and journeys

| ID | User | Need | Benefit | Flow or edge |
| --- | --- | --- | --- | --- |
| US-01 | Developer | See the design of the work of the session as a diagram | Find design problems before the commit | Types `/visual-review`; the page opens when the analysis is ready |
| US-02 | Developer | Compare against a base other than the main branch | Review only the last commits | Types `/visual-review HEAD~3` |
| US-03 | Reviewer | Write a change request or a question on a unit, member, relation, table, column or the whole review | Give precise feedback | Clicks the element, writes the comment, selects the type |
| US-04 | Reviewer | Send all comments at once | Claude gets the full context of the review | Clicks "Submit review"; Claude answers the questions and proposes a plan for the change requests |
| US-05 | Reviewer | See the comments of the previous round after Claude changed the code | Check if each comment is addressed | Runs `/visual-review` again; marks each old comment as resolved or keeps it open |
| US-06 | Reviewer | Read a large change | Keep the diagram readable | Opens and closes namespace or folder containers |
| US-07 | Developer without Node.js | Still review the design | Use the mod with no extra install | Gets a static page; copies the review text and pastes it in the prompt |
| US-08 | Developer | Know why no page opened | Fix the cause | Gets a message: not a Git repository, no changes, invalid base, or analysis failed |

## Functional requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-01 | The mod registers the command `/visual-review [base]`. The command runs only when the user types it | The command shows in the command menu with its description and argument hint; no analysis starts without the command |
| FR-02 | With no argument, the base is the merge-base of `HEAD` and the main branch. The main branch is the target of `origin/HEAD`, else `main`, else `master`. The diff includes committed, staged, unstaged and untracked (not ignored) changes | A file created and not yet added to Git shows on the page as added |
| FR-03 | With an argument, the base is that Git reference | `/visual-review HEAD~1` shows only the changes after `HEAD~1`; an invalid reference shows an error that names it, and no analysis starts |
| FR-04 | Outside a Git repository, or with an empty diff, the command shows a message and stops | No prompt goes to the session and no page opens |
| FR-05 | A subagent analyzes the diff and returns a design model. The model of the subagent is a user setting with the default `sonnet` | Changing the setting changes the model that the analysis uses on the next run |
| FR-06 | The mod accepts the design model only when every changed source file is covered and the model is valid. Otherwise it returns the list of gaps to Claude for a new attempt | A model that omits a changed `.cs`, `.ts` or `.py` file is rejected with a message that names the file |
| FR-07 | The page shows units of the kinds class, interface, record or struct, enum and module. A module is 1 file with code but no class | A TypeScript file with only exported functions shows as 1 module unit |
| FR-08 | Each unit has 1 state: added, modified, deleted or context. Context units are direct neighbors that did not change; they show in gray | A deleted class shows with the deleted state; an unchanged class that a new class uses shows as context |
| FR-09 | A unit card shows: name, kind, state, total lines, lines added and removed (modified units), number of methods, changed members, a summary of 1 to 3 sentences, cohesion from 1 to 5 with a 1-sentence reason, Ce and Ca | All fields are present on every non-context unit card |
| FR-10 | Line counts and line deltas come from Git, not from the model | For a file with 1 unit, the unit delta equals `git diff --numstat` for that file; for a file with many units, the unit deltas plus the lines outside units equal the file delta |
| FR-11 | Ce is the number of distinct units that a unit depends on. Ca is the number of distinct units that depend on it. The mod calculates both from the relations of the model, context units included | Ce and Ca on the card equal a count of the arrows on the diagram |
| FR-12 | Relations have the kinds inheritance, implementation, composition and dependency, and the states added, removed and unchanged | A removed `extends` shows as a removed inheritance arrow |
| FR-13 | The page shows database tables with the states added, modified and dropped. A table shows its columns with their state, type changes and foreign keys | An EF Core migration that adds 1 column shows the table as modified and the column as added |
| FR-14 | The analysis finds tables in EF Core migrations and `DbContext`, Prisma, TypeORM, Drizzle, `.sql` files, SQLAlchemy, Alembic and Django migrations | A change in each listed source produces a table on the page |
| FR-15 | A dashed line links each entity unit to its table. Tables are in their own area of the same diagram. A filter shows units, tables or both | The filter hides and shows each layer with no page reload |
| FR-16 | Changed files that are not source code show in an "Other files" list with their line deltas | A changed `README.md` shows in "Other files" |
| FR-17 | Units are grouped in containers: namespace for C#, folder for TypeScript and Python. A container with only context units is closed by default. The reviewer opens and closes each container | A container closes and opens with 1 click or the keyboard |
| FR-18 | The reviewer adds a comment to a unit, a member, a relation, a table, a column or the whole review. Each comment has the type "Change request" or "Question". The reviewer edits or deletes a comment before submit | Each anchor kind accepts a comment; the comment shows next to its anchor |
| FR-19 | "Submit review" sends all comments as 1 prompt to the session. The prompt names the anchor and the type of each comment, and tells Claude to answer the questions, propose a plan for the change requests, and wait for confirmation before it changes code | The prompt shows in the session; Claude changes no file before the user confirms the plan |
| FR-20 | If the session is busy, the review prompt waits until the session is idle. The page confirms that the review was received | The page shows "Review sent" after the submit |
| FR-21 | The page opens in the default browser after the mod accepts the model. If the page of the session is already open, that page shows the new model and keeps the comment drafts | A second run updates the open tab; no second tab opens |
| FR-22 | The mod stores the comments by project and branch. A rerun shows the previous comments with the status open or resolved. The reviewer changes the status | After a rerun, a comment of the previous round shows with its status |
| FR-23 | A stored comment whose anchor is not in the new model shows in an "Unanchored" list | A comment on a deleted method shows in "Unanchored" |
| FR-24 | When Node.js is not available, the mod produces a static page with the same diagram. A "Copy review" button copies the review text. Claude Code shows why the page is static | With no `node` on the PATH, the page opens and "Copy review" puts the text in the clipboard |
| FR-25 | Claude Code shows the progress while the analysis runs, and an error message when the analysis fails | The user sees a status during the analysis and a message that names the cause on failure |

## Non-functional requirements

| ID | Attribute | Limit or criterion |
| --- | --- | --- |
| NFR-01 | Security | The page is reachable only from `127.0.0.1` and only with a secret token per session; a request without the token gets HTTP 403 |
| NFR-02 | Offline use | The page loads no resource from the internet; a network capture while the page is open shows only local requests |
| NFR-03 | Supported API | The mod uses only documented members of the `claude-code` types, with no `@internal` member, no undocumented endpoint and no credential read from disk |
| NFR-04 | Determinism | File line counts and file line deltas are identical on 2 runs over the same diff; unit line deltas, Ce and Ca are identical on 2 runs over the same design model (OBJ-04) |
| NFR-05 | Performance | A model with 100 units and 30 tables renders and is interactive in 3 s or less after the page opens |
| NFR-06 | Lifetime | The page server stops when the session ends; no `node` process of the mod remains after the session ends |
| NFR-07 | Accessibility | The state of a unit, member, relation, table or column shows with a label or icon, not only with color; all nodes, containers and comment forms work with the keyboard; text contrast meets WCAG 2.1 AA in the light and the dark theme |
| NFR-08 | Platform | The command works on Windows, macOS and Linux, and in the terminal and the desktop app of Claude Code |
| NFR-09 | Storage | The comments of the mod stay inside the 4 MiB limit of `$.store`; when the limit is near, the oldest branch review goes first |
| NFR-10 | Cost | Each command run starts at most 1 analysis; nothing starts an analysis automatically |
| NFR-11 | Language | All UI text, prompts, comments in code and the README are in English |

## User experience

1. The user types `/visual-review`. Claude Code shows a status: "Analyzing the design of the change…".
2. When the model is accepted, Claude Code shows "Visual review ready" with the link, and the browser opens the page.
3. The page shows a toolbar (base reference, counts of added, modified and deleted units and tables, filter, "Submit review"), the diagram, and a side panel with the comments.
4. A unit card shows a state badge (`+`, `~`, `−`, `ctx`) and a color. A cohesion note shows as `C 1–5` with a tooltip that holds the reason. Ce and Ca show as numbers.
5. A click on a unit, member, arrow label, table or column opens the comment form. A long arrow has a label in the middle as its click target.
6. "Submit review" sends the review. The page shows "Review sent". The session shows the review prompt.
7. After a rerun, the side panel shows the previous comments with a status switch, and the "Unanchored" list.

Error states:

- Not a Git repository: "visual-review needs a Git repository."
- Empty diff: "No changes against <base>."
- Invalid base: "Unknown Git reference: <ref>."
- No Node.js: "Node.js not found. The page is static: use Copy review to send the comments."
- Analysis failed: "The design analysis failed: <cause>."

## Constraints and dependencies

- Claude Code with the plugin function-hooks API; types from Claude Code 2.1.301 (`session-info/.claude-plugin/types/claude-code/index.d.ts`).
- The hooks module has no Node.js runtime and cannot listen on a port. An interactive page needs an external `node` process on the PATH (decision Q5); without it, FR-24 applies.
- There is no API that opens a URL. The mod opens the browser with a system command, like `session-info/hooks/viewer.ts`.
- The organization policy `cc-plugin-sec-default` on this machine skips some hooks (`classic.SessionStart`, `session.append`, `prompt.compose`, `skill.prompt`). The mod must depend only on hooks that are not on that list.
- Repository rules in `AGENTS.md`: own top-level folder, README with an Install section, registration in `.claude-plugin/marketplace.json` and the root `README.md`, and the checks `claude plugin validate` and `claude plugin test`.

## Out of scope

- Automatic analysis at the end of a turn or before a commit.
- Static analysis with parsers per language, and an exact LCOM calculation.
- Guaranteed support for languages other than C#, TypeScript and Python.
- Comments sent to GitHub, GitLab or another pull request service.
- Shared or remote hosting of the page, and more than 1 reviewer at the same time.
- Code changes made from the page.
- A diagram inside the Claude Code pane instead of the browser.

## Assumptions and sources

- Assumption: Sonnet gives cohesion notes and summaries good enough for a design review. Source: decision Q16. Impact if wrong: the default model changes; FR-05 already makes it a setting.
- Assumption: the hooks `command.run` and `tool.call` are not skipped by the organization policy. Source: the commands and tools of `session-info` work in this session. Impact if wrong: the command does not run; check with `--debug-file`.
- Assumption: the analysis can give the line range of each unit, so the mod can split the Git line deltas of a file between its units (FR-10). Impact if wrong: the unit delta shows only at file level.
- Assumption: drafts survive a page update (FR-21) only while the tab stays open; a closed tab loses unsent drafts. Impact if wrong: drafts need storage in the mod.
- Product decisions Q1 to Q16 come from the user in the grilling session of 2026-10-22.
- Facts on the API: `$.command.register`, `$.tool.register`, `$.prompt.submit`, `$.process.run`, `$.process.spawn`, `$.http.fetch`, `$.store`, `$.plugin.root`, `$.model.fork` and `$.model.complete` in the types file named above.

## PRD acceptance gate

- [x] Every requirement has an ID and an observable criterion.
- [x] Metrics, boundaries, and out-of-scope items are explicit.
- [x] Internal rules came from the user or an identified project source.
- [x] Implementation details remain in the TechSpec.
