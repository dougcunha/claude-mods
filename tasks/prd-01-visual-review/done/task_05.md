# Stable execution context

Load in this exact order:

1. `tasks/prd-01-visual-review/prd.md`
2. `tasks/prd-01-visual-review/techspec.md`
3. This file

Use the current PRD and TechSpec versions already loaded; recover only missing or changed sources. This order does not guarantee a host cache hit.

---

# T05 — Diagram page

## Outcome

The page draws the view model: unit cards with state badge and all card fields, relation arrows with kind and state and a clickable middle label, the table layer with columns and dashed entity links, containers that open and close, the "Other files" list, the toolbar with base and counts, and the filter (units, tables, both). It works offline, by keyboard, in the light and the dark theme, and draws 100 units and 30 tables in 3 s or less.

## Dependencies and boundaries

- Depends on: T04
- Unblocks: T06
- In scope: `web/index.html`, `web/app.js` (classic script), `web/style.css`, vendored `web/vendor/elk.bundled.js` 0.9.3 with its license header, a 100-unit fixture for timing.
- Out of scope: comment forms and the side panel (T06); static mode (T07); any calculation that the view model already holds (DEC-07).

## Traceability

| Source | Section | Obligation covered |
| --- | --- | --- |
| FR-08, FR-09, FR-12, FR-13, FR-15, FR-16, FR-17 | `prd.md#functional-requirements` | Drawing of states, cards, relations, tables, filter, other files, containers |
| NFR-02, NFR-05, NFR-07 | `prd.md#non-functional-requirements` | Offline, performance, accessibility |
| DEC-05, DEC-06, DEC-07 | `techspec.md#technical-decisions` | Own cards + ELK, classic scripts, no logic in the page |
| CMP-11 | `techspec.md#components-and-flow` | Page |
| TC-19 | `techspec.md#test-approach` | Manual: timing, keyboard, themes, tab update |

## Context to recover on demand

- Applicable skills and rules: quality rule QA-06; skill `artifact-design` is not required (local page), but WCAG 2.1 AA contrast is.
- Existing code: `visual-review/hooks/view.ts` (view model type, from T03).
- Contract or integration: `techspec.md#components-and-flow` (CMP-11), `prd.md#user-experience`.
- Engine reference: not applicable (browser code).

## Work

- [x] T05.1 Vendor `elk.bundled.js` from `elkjs@0.9.3` with its EPL-2.0 header; name it in `visual-review/README.md`.
- [x] T05.2 Write `web/app.js`: map the view model to an ELK graph with containers as compound nodes; draw cards and edges in SVG/HTML; middle label on each edge.
- [x] T05.3 Toolbar, filter and container toggles; state labels (`+`, `~`, `−`, `ctx`) besides color; cohesion tooltip with the reason.
- [x] T05.4 Keyboard: focus order over containers, cards, edge labels and tables; visible focus; light and dark tokens with AA contrast.
- [x] T05.5 Build a 100-unit, 30-table fixture and measure the time to interactive.

## Acceptance criteria

- Every field of FR-09 shows on each non-context card; context cards are gray.
- The filter hides and shows units and tables with no reload; containers open and close by click and by keyboard.
- The network panel shows only `127.0.0.1` requests.
- The 100-unit fixture is interactive in 3 s or less on this machine.

## Verification

- Unit: not applicable (no logic in the page; the view model is tested in T03).
- Kit: not applicable.
- Real session: run `/visual-review` on a change with 1 added, 1 modified, 1 deleted class and 1 migration; compare the page with `view.json`.
- Manual: TC-19 (timing, keyboard only, themes, tab update); owner: the developer.
- Platforms: Windows with Chrome or Edge; another browser if available.
- Commands: `claude plugin validate visual-review`, `claude plugin test visual-review`; QA-06.
- Environment dependency: Node.js on the PATH; a browser.
- Expected evidence: screenshots in light and dark; the timing number; the network panel.

## Affected files

- Modify: `visual-review/web/index.html`, `visual-review/README.md`
- Create: `visual-review/web/app.js`, `visual-review/web/style.css`, `visual-review/web/vendor/elk.bundled.js`, `visual-review/tests/fixtures/large-view.json`

## Observability and recovery

- Operational signal: the page shows a short error box when `/view` fails or the JSON does not parse.
- Recovery: a rerun writes a new view model; the page reloads it.

## Handoff

> Updated by `sdd-execute-task` during implementation.

- Produced result: the page draws the view model. `web/app.js` (classic script) measures each card, lays out containers (compound nodes), units, the table group and the edges with ELK.js 0.9.3 (`layered`, `INCLUDE_CHILDREN`, orthogonal edges, centered edge labels), and draws HTML cards over an SVG layer of container boxes and arrows. Unit cards show the state badge (`+`, `~`, `−`, `ctx`), name, kind, total lines, lines added and removed, methods, cohesion `C n` with its reason as tooltip and accessible name, Ce, Ca, the summary, the changed members with their state, and a note when the range was not checked; context cards are gray and dashed. Relations have kind markers (hollow triangle, open arrow, filled diamond), dashed lines for implementation and dependency, and a focusable middle label `kind · state`; relations into a closed container go to the container and merge. Tables show columns with state, type change, PK and FK; a dotted line links each entity to its table. Containers open and close by click, Enter or Space; the toolbar shows base, branch, counts and a 3-way filter; the "Other files" list shows non-diagram files and skipped files with the reason. Light and dark tokens follow the system theme. Elements carry `data-anchor` and `data-id` for the T06 comment anchors. The page also reads `window.VIEW` for the T07 static mode.
- Changed files: created `visual-review/web/style.css`, `web/vendor/elk.bundled.js` (elkjs 0.9.3 `lib/elk.bundled.js` from `npm pack`, with a 1-line header that names the version, source and license), `web/vendor/ELK-LICENSE.md` (the EPL-2.0 text of the package), `tests/fixtures/large-view.json` (100 units in 10 containers, 130 relations, 30 tables, 20 entity links); modified `web/index.html`, `web/app.js`, `README.md` (page section, limitation, ELK license line).
- Checks:
  - `claude plugin test visual-review`: 73 pass, 0 fail (no page logic to test, DEC-07). `claude plugin validate visual-review`: passed.
  - Quality profile: QA-06 no hit (`listen` names `127.0.0.1`; no `http(s)://` in `web/` outside `vendor/`; the SVG namespace is read from the page's own element). QA-01 to QA-05 no hit.
  - Browser (Playwright Chromium, this machine, server on the 100-unit fixture): `Drew 100 units and 30 tables in 1181 ms` on first load (page loaded at 190 ms), later draws 729–979 ms: interactive in about 1.5 s, under the 3 s of NFR-05. 0 overlapping cards. The network panel lists only `127.0.0.1` requests (page, `style.css`, `vendor/elk.bundled.js`, `app.js`, `/view`, `/events`); the favicon request (403) was removed with an empty data icon.
  - Keyboard: Enter on a container header closes and opens it (`aria-expanded` follows, cards 120 → 110 → 130), the focus stays on the header after the redraw; Tab from a container header goes to its first card; the focus ring is visible (`outline: solid`). The filter (`Tables`, `Units`, both) redraws with no reload (`tables only`: 30 cards, 0 units; `units only`: 90 units, 0 tables, 0 entity links).
  - Themes: light and dark screenshots (`t05-light.png`, `t05-dark.png` in the session scratchpad). Minimum contrast of the text and state tokens on every background: 4.77:1 light, 5.16:1 dark (WCAG 2.1 AA).
  - Real model: the `view.json` of the T03 real session (1 added class, 1 modified class, 1 composition) written into the watched folder updated the open tab with no reload; the 2 cards and the label match the file (`+ Cart class 11 lines +11 2 methods C 5 Ce 1 Ca 0 …`, `~ Item class 7 lines +4 −0 1 method C 5 Ce 0 Ca 1 …`, `composition · added`).
- Validated state: base `8d5ddeb` plus the T01 to T05 diff; Windows 11, Chromium (Playwright), Node.js v24.20.0.
- Open items:
  - ELK 0.9.3 ignores `elk.json.shapeCoords` and `elk.json.edgeCoords`, so the page adds the parent offsets itself (nodes) and the container offset (edges and labels).
  - The stress fixture makes a wide canvas (about 28,800 px) because of its many relations across containers; the page scrolls, and closing containers or the filter makes it readable. A real change of this size was not drawn.
  - The visual check of the TechSpec manual script (TC-19 with a real C#, TypeScript and Python change, on the person's own browser, and 1 other browser) stays pending manual acceptance (autonomous mode: visual check recorded, not approved).
  - The SVG namespace change in `app.js` came after the browser runs; it uses the namespace of the page's own `<svg>` element, which is the same value.

### ADR candidates

None - direct TechSpec implementation or local decision.
