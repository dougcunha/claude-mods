# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A developer who works with Claude Code finishes a task on a branch and reviews the design of that change before reading the diff. The developer reviews their own branch: they read the classes, modules, relations and database tables, write comments, and send the review back to the same Claude Code session.

## Product Purpose

`/visual-review` turns the changes of a branch against a base into a design diagram in the browser. A subagent analyzes the diff, the mod measures the line changes from Git, and the page draws units, relations and tables. The reviewer comments on any element and submits the comments as 1 prompt; Claude answers the questions and proposes a plan for the change requests.

Success: the developer sees the shape of the change (what was added, modified and deleted, and how it is coupled) faster than by reading the diff, and turns what they see into precise comments.

## Positioning

The diagram comes from a design analysis by Claude, but every number on it comes from Git, not from the model. The comments go straight back into the session that made the change, so review and correction happen in one loop.

## Operating Context

- The page opens in the default browser, beside the terminal that runs Claude Code. The developer moves between the page and the terminal.
- A run can show from 1 to about 100 units and 30 tables. Large changes make a wide diagram that the reviewer pans, filters, and opens or closes by container.
- Comments have rounds: drafts of this round, earlier rounds with an Open or Resolved status, and unanchored comments whose element is gone.
- 2 page modes: the served page (Node.js, live updates, **Submit review**) and the static page from a file (no Node.js, **Copy review**).

## Capabilities and Constraints

- Plain HTML, CSS and a classic script (`web/`), no build step and no package. The static page loads the same files over `file://`.
- The page loads nothing from the internet, and the server's Content-Security-Policy allows only its own origin. Every request to the server must carry the review token, so a CSS `url()` to a local font file gets HTTP 403: the page uses system font stacks.
- The layout engine (elkjs) measures each card, label and container header in the DOM before it places them. A style that changes an element's size after measurement breaks the layout.
- Terminology: unit (class, module, interface…), container (namespace or folder), relation (inheritance, implementation, dependency, composition), table, column, member, state (added, modified, deleted, dropped, removed, unchanged, context), round, draft, change request, question.
- Metrics on a unit card: lines, lines added and removed, methods, cohesion `C 1`–`C 5` with a reason, Ce and Ca.

## Brand Commitments

The page sits close to the identity of Claude Code, the product it belongs to (the README's badge uses the Claude Code orange `#d97757`). The mod has no logo or brand of its own.

## Evidence on Hand

- `tests/fixtures/large-view.json`: a real-shape view model with 100 units and 30 tables, for renders and screenshots.
- The README documents every element of the page and its behavior.
- No screenshots, testimonials or usage data exist. Do not invent them.

## Product Principles

1. The diagram is the review: the reviewer sees the design before any code.
2. Numbers are measured, never estimated; the page shows what is unknown as unknown.
3. A comment is 1 click or 1 key away from every element it can be about.
4. The page works the same with and without Node.js, offline, and in both themes.

## Accessibility & Inclusion

- WCAG 2.1 AA contrast in the light and the dark theme; the theme follows the system (`prefers-color-scheme`).
- Full keyboard use: Tab reaches every container header, card, member, column and arrow label in reading order; Enter or Space opens a form or a container.
- Each state has a text badge (`+`, `~`, `−`, `ctx`), not only a color (WCAG 1.4.1).
