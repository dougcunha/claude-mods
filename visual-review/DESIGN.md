---
name: Visual review
description: The review page of the visual-review mod, a ruled design diagram of one branch with a comment panel.
colors:
  bg: "#faf9f5"
  panel: "#faf9f5"
  text: "#141413"
  muted: "#5e5d59"
  rule: "#d9d6cc"
  hover: "#efede5"
  card: "#ffffff"
  added: "#1a7f37"
  modified: "#1f5fbf"
  deleted: "#c42b2b"
  context: "#5e5d59"
  on-state: "#ffffff"
  clay: "#b5522f"
  on-clay: "#ffffff"
typography:
  display:
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.2
  mono:
    fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "18px"
rounded:
  none: "0px"
spacing:
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
  button-hover:
    backgroundColor: "{colors.hover}"
  button-primary:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.on-clay}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.text}"
    textColor: "{colors.bg}"
  button-form-save:
    backgroundColor: "transparent"
    textColor: "{colors.clay}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
  button-form-save-hover:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.on-clay}"
  filter-segment:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "5px 10px"
  filter-segment-pressed:
    backgroundColor: "{colors.text}"
    textColor: "{colors.bg}"
  select:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "2px 24px 2px 6px"
  textarea:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "6px 8px"
    height: "88px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "8px 10px 9px"
    width: "260px"
  card-context:
    backgroundColor: "transparent"
    textColor: "{colors.context}"
  state-badge:
    backgroundColor: "{colors.context}"
    textColor: "{colors.on-state}"
    rounded: "{rounded.none}"
    padding: "0 4px"
    width: "22px"
  state-badge-added:
    backgroundColor: "{colors.added}"
  state-badge-modified:
    backgroundColor: "{colors.modified}"
  state-badge-deleted:
    backgroundColor: "{colors.deleted}"
  edge-label:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 5px"
  container-head:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "5px 10px"
    height: "32px"
  comment-count:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.on-clay}"
    rounded: "{rounded.none}"
    padding: "0 5px"
  comment-form:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "10px 12px 12px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    padding: "0 20px 20px"
    width: "360px"
---

# Design System: Visual review

## Overview

**Creative North Star: "The Ruled Change Sheet"**

The page is a printed sheet that has been ruled and counted. Warm paper, near-black ink, a neo-grotesk set flush-left, and the size of the change set as poster numerals across the top. Structure comes from lines, not from boxes floating on shadows: 1 px rules separate, 3 px ink rules mark the 2 main divisions of the sheet, and every state is a solid square with a glyph.

Density is the point. Rows are 12/18 px, cards are 260 px wide, the layout engine packs them at its own spacing, and nothing is padded for air. Color is functional: 4 state colors that each do 1 job, and 1 accent, clay, that appears only where the reviewer is writing or sending a review. The page follows the system theme; both themes are designed, neither is derived.

The world sits close to the Claude Code identity (warm paper, `#1f1e1d` in the dark theme, near-black ink, the clay orange family) and has no logo of its own.

**Key Characteristics:**
- Square corners everywhere; no radius, no shadow, no gradient.
- 1 px rules for structure, 3 px ink rules only for the major divisions and the state top rule.
- Tabular figures on the whole page.
- State shown twice: a color and a text glyph (`+`, `~`, `−`, `ctx`, `=`).
- Clay reserved for the review path.
- Stepped, near-instant state changes instead of eased motion.

## Colors

A warm paper-and-ink neutral pair, 4 single-purpose state colors as the secondary role, and 1 reserved accent. Every token has a dark value under `prefers-color-scheme: dark`; dark values are listed in parens and in the sidecar.

### Primary
- **Review Clay** (light; dark `#e07a55`): the review path only. Fill of the primary Submit review / Copy review button and the comment count chip; the 2 px outline of the comment target; the 3 px top rule of the comment form; the outlined Save; the radio accent, the textarea caret and the text selection. Text on it uses **On Clay** (white light, `#1f1e1d` dark).

### Secondary
- **Added Green** (dark `#4ac26b`): added units, tables, members, relations, `+` line deltas.
- **Modified Blue** (dark `#6aa1ff`): modified units, tables and members.
- **Deleted Red** (dark `#ff6b6b`): deleted, dropped and removed elements, `−` line deltas, the error status line.
- **Context Grey** (same value as Muted; dark `#a3a199`): unchanged context units, shown as a dashed, transparent card.
- **On State** (white light, `#1f1e1d` dark): the glyph inside a solid state badge.

### Neutral
- **Warm Paper** `bg` (dark `#1f1e1d`): the page ground, sticky header, container heads, edge labels, inputs.
- **Panel Paper** `panel` (same as `bg` today, separate token): the comment column ground.
- **Card White** `card` (dark `#262624`): unit and table cards, the comment form. The only raised tone.
- **Ink** `text` (dark `#f0eee6`): body text, container frames, heavy rules, button borders, the focus ring, the pressed filter fill.
- **Muted Ink** `muted` (dark `#a3a199`): secondary text, labels, metrics, relation strokes, input borders.
- **Hairline** `rule` (dark `#3a3936`): card borders, list dividers, count column dividers, quiet button borders. A quiet divider: low contrast by design, so it never carries meaning alone.
- **Hover Wash** `hover` (dark `#2c2b29`): hover fill of buttons and of member and column rows.

### Named Rules
**The One Job Rule.** Each state color means one state and nothing else. Green is never "success", blue is never "link", red is only deletion or an error.

**The Clay Path Rule.** Clay appears only on the review path: comment counts, the comment target, the comment form (with its radio accent and caret), the review submit button, and the text selection. Clay never marks state, navigation or decoration.

**The Two Signals Rule.** No state is carried by color alone; every state color travels with a glyph badge or a sign (WCAG 1.4.1).

## Typography

**Display Font:** Helvetica Neue (with Helvetica, Arial, sans-serif)
**Body Font:** Helvetica Neue (with Helvetica, Arial, sans-serif)
**Label/Mono Font:** ui-monospace (with Cascadia Mono, Consolas, Menlo, monospace)

**Character:** An objective neo-grotesk for everything a person reads, and the system monospace for code identifiers (members, columns, file paths) and the badge glyphs. Both are system stacks by necessity.

### Hierarchy
- **Display** (700, 30px, line-height 1, -0.02em): the change counts in the header only, colored by state, muted when zero.
- **Headline** (700, 20px, 1.2, -0.01em): the page title.
- **Title** (700, 14px, 1.3): the unit or table name on a card. The panel title is one step under the page title (15px, 1.2); panel section heads use 13px bold over a 1 px ink rule.
- **Body** (400, 13px, 1.45): base text, comments, buttons. Card summaries use 12.5px.
- **Label** (400, 12px, 1.2): count labels, metrics, base/branch line, status line, comment meta, filter buttons, edge labels, container heads (700, 12px/20px). The kind label on a card is 12px muted, pushed right.
- **Mono** (400, 12px, 18px): member and column rows, the other-files list. Badge glyphs are mono 700 at 11px/17px.

### Named Rules
**The Tabular Rule.** `font-variant-numeric: tabular-nums` is set on the body; every figure on the page aligns in columns.

**The System Stack Rule.** Only system font stacks. The server's CSP is `default-src 'self'` and every request needs the per-request review token, so a CSS `url()` to a font file is refused; the static page also loads offline over `file://`. Do not add web fonts.

## Layout

A two-column sheet at 901 px and wider: the diagram column (header, status, diagram, other files) fills the window, and the comment panel is a fixed 360 px column on the right behind a 3 px ink rule. The body reserves the panel width as right padding. A bar sits between the header and the diagram: the view switch (Overview, Diagram, List, the filter's segmented style) flush-left, then the status line, the focus line when a card is in focus, and the zoom group (`−`, the percent, `+`, Fit, joined like the filter) flush-right; List hides the zoom group. The diagram, or the list in List view, takes the height left under the bar and scrolls on its own, so both of its scroll bars stay at the window edges; the other files list keeps at most 30vh and scrolls inside it. A mouse drag on the diagram pans it (grab cursor, grabbing while it moves). **Hide comments** removes the panel and its padding, and the diagram takes the full width.

The header is a grid: title and base line flush-left in the first column, the 6 count columns (84 px each, 1 px hairline left rule, the units/tables split marked by a 3 px ink rule and 8 px gap) to its right, then the controls: the filter and the Hide comments toggle, 8 px apart. At 1400 px and wider all 3 sit on one row and the header is 88 px; below 1400 px the controls move under the title and the header is 112 px. The panel head shares the same `--head-height`, so the header rule and the panel head rule line up across the sheet.

At 900 px and narrower the sheet stacks: header (static, single column, counts wrap 3 per row), diagram, then the panel below with a 3 px ink top rule. Gutters are 24 px wide and 16 px narrow.

The diagram is placed by elkjs (layered, top-down, orthogonal routing): 28 px between nodes, 48 px between layers, 4 px around edge labels; containers pad their children 12 px on the sides and bottom and 44 px on top (the 32 px head plus 12 px). Spacing inside components runs on 4/6/8/10/12 px steps.

### Named Rules
**The Measured Size Rule.** elkjs measures every card, edge label and container head in the DOM before layout. A card being measured carries a hidden-visibility state and must stay invisible but laid out; no style may change an element's size after measurement (no hover padding, no font swap, no late border width change).

**The Head Constant Rule.** The container head is 32 px high and laid out as 220 px wide when closed; `HEAD_HEIGHT = 32` and `HEAD_WIDTH = 220` in `web/app.js` are tied to it. Change the CSS and the constants together.

## Elevation & Depth

The sheet is flat. There are no drop shadows, no blur, no gradients. Depth is conveyed by tone and rule weight only: the card white sits one tone above the paper, the 3 px ink rules mark the main divisions, and the sticky header and fixed panel are separated by those rules rather than by lift. The only `box-shadow` in the system is a 1 px inset stroke that draws the outline of the hollow context badge, a border device, not elevation.

### Named Rules
**The Ink Not Lift Rule.** Separate with a rule, never with a shadow.

## Shapes

Every corner is square (0 px). Shape language is the line: solid 1 px for structure, 3 px ink for the 2 sheet divisions (under the header, left of the panel), 3 px colored top rule on each card and on the comment form. Dashing carries meaning: dashed frames and heads for the tables group, dashed strokes for implementation and dependency relations, dotted for table links, dashed transparent cards for context units. The UML marker set is drawn in SVG: hollow triangle filled with paper, open arrow, filled diamond, each with a 1.5 px stroke. The only drawn icon is the container chevron, two 1.5 px borders of a 5 px square rotated 45 degrees.

## Components

### Buttons
Ink-outlined, square and compact.
- **Shape:** square (0 px), 1 px ink border, transparent fill.
- **Default:** body type, 4px 10px padding.
- **Primary:** Submit review / Copy review, clay fill, bold, 8px 14px in the panel head. The only filled button on the page. Hover inverts to ink fill with paper text.
- **Form Save:** the clay outline of the primary (clay text and border, transparent); hover fills clay.
- **Focus:** on each card head after the kind, 11px, 0 5px, hairline border; it shows only on the hover or the focus of its card, and always on the card in focus, where it reads Show all. The card in focus takes an ink frame.
- **Panel toggle:** Hide comments / Show comments (with the new-comment count), a default button at the filter's 12px, 5px 10px, next to the filter.
- **Quiet:** comment Edit / Delete, 12px, hairline border that turns ink on hover.
- **Hover / Focus:** hover wash fill; focus is a 2 px ink outline offset 2 px. Transitions are `90ms steps(2, jump-none)` on background and color, removed under `prefers-reduced-motion`.

### Filter (segmented control)
- **Style:** 3 adjacent square ink-outlined buttons at 12px, 5px 10px, inner borders collapsed.
- **State:** the pressed segment (`aria-pressed`) fills ink with paper text.

### Cards
- **Corner Style:** square.
- **Background:** card white; context cards are transparent with a dashed muted border and context text.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1 px hairline, plus a 3 px top rule in the state color (added, modified, deleted/dropped). Hover on an anchored card darkens the border to muted.
- **Internal Padding:** 8px 10px 9px, width 260 px.
- **Content:** name row (badge, title, kind), metrics on 2 deliberate rows (size, then quality with a dotted-underlined cohesion), a summary, member or column rows in mono that take the whole row for click, hover and focus.

### Inputs / Fields
- **Style:** paper ground, 1 px muted border, square. The select draws its caret with 2 gradient triangles; the textarea is at least 88 px high, vertical resize, clay caret.
- **Focus:** 2 px ink outline (offset 0 on the textarea).

### State Badge (signature)
A solid square, minimum 22 px wide, mono 700 11px/17px glyph in on-state color: `+` added, `~` modified, `−` deleted/dropped/removed. Context and unchanged badges are hollow: transparent with a 1 px inset context stroke and context text (`ctx`, `=`).

### Change Counts (signature)
The header's poster numerals: 6 columns of a display figure over a 2-line 12px muted label, each column behind a 1 px hairline, the units and tables groups split by a 3 px ink rule. Figures take their state color; a zero count goes muted.

### Container Frame and Head (signature)
A 1 px ink SVG frame (dashed for tables) with a 32 px head band on paper: 12px bold, 5px 10px, an ink bottom rule (dashed for tables), the drawn chevron pointing down when open and right when closed. A closed container is only its head and the head carries the full 1 px ink frame. The tables group closes the same way, with a dashed frame. In Overview each closed head is a larger box (48 px, 18px bold, 10px 14px) whose text adds the changed-state counts, so it stays legible after Fit.

### Overview Arrow
A plain muted line with an open arrow between 2 Overview boxes, standing for every relation between them; no label, so the layout stays small. Its width grows with the count (1 px plus half a pixel a relation, at most 5 px), and an SVG title names the kinds.

### List Row
A list row is the card content on 1 full-width row (at most 920 px): card white, a 3 px left rule in its state color in place of the card's top rule, a hairline bottom divider, and the wash on hover; a context row is transparent with a 1 px dashed left rule. Under the members, the relations wrap as 12px items: the state badge, the relation in words, and a mono underlined link to the other row, clay on hover. A jump to a row marks it with a 2 px ink inset outline for 1.5 s. The group head is the container head, static and full width.

### Edge Label
A small square label on paper over a relation, 12px/17px, 1 px border in its own text color (muted, added or removed), underlined on hover so the state text keeps its contrast on paper. It can hold a clay comment count.

### Review Path Elements
- **Comment count:** clay chip, 700 11px/16px, 0 5px, after an element's name.
- **Comment target:** 2 px clay outline offset 2 px on the element the open form is about (offset -2 px on member and column rows).
- **Comment form:** card white, 1 px ink border, 3 px clay top rule, 10px 12px 12px, 8px gaps.
- **Comment list:** 1 px hairline row dividers, 12px muted meta line, pre-wrapped text, quiet actions.

## Do's and Don'ts

### Do:
- **Do** keep every corner at 0 px and separate surfaces with 1 px rules; reserve 3 px ink for the header bottom, the panel edge and the counts split.
- **Do** pair every state color with its glyph badge or sign.
- **Do** keep clay on the review path only: comment counts, the comment target, the comment form, the review submit button, and the text selection.
- **Do** use system font stacks and tabular figures.
- **Do** keep text at WCAG 2.1 AA (4.5:1, 3:1 for large text) on paper, card and hover wash in both themes, and check a new pairing in light and dark.
- **Do** step state changes at `90ms steps(2, jump-none)` and drop them under reduced motion.
- **Do** make every commentable element a full-width target with a visible hover and a 2 px focus ring.
- **Do** change `HEAD_HEIGHT` / `HEAD_WIDTH` in `web/app.js` together with the container head CSS.

### Don't:
- **Don't** add shadows, gradients, glass, blur or radius.
- **Don't** add web fonts or any `url()` asset; the CSP and the per-request token refuse them.
- **Don't** change an element's size after elkjs measures it, and don't make the measuring card visible.
- **Don't** use clay for state, navigation, emphasis or decoration.
- **Don't** add a second clay-filled button; the review submit button is the only one (the pressed filter segment is an ink fill, a state, not an action).
- **Don't** add eased or springy motion.
- **Don't** let the panel compete with the diagram: no fills, colors or type sizes louder than the header.
