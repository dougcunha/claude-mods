import { expect, test } from 'claude-code/testing'

import type { Comment } from '../hooks/comments'
import { analysisModelOf, analysisPrompt, reviewPrompt, SUBMIT_DESCRIPTION } from '../hooks/prompts'
import type { AnalysisRun, ReviewInput } from '../hooks/prompts'
// The page's classic script sets globalThis.reviewText; it has no export to import by name.
import '../web/review-text.js'

const RUN: AnalysisRun = {
  runId: 'vr-1',
  root: 'C:/work/shop',
  base: '540a818',
  baseLabel: 'origin/main',
  files: [
    { path: 'src/Cart.cs', added: 12, removed: 3, isUntracked: false },
    { path: 'src/Basket.cs', oldPath: 'src/OldBasket.cs', added: 1, removed: 1, isUntracked: false },
    { path: 'logo.png', added: null, removed: null, isUntracked: true },
  ],
  model: 'sonnet',
}

const SONNET_PROMPT = `visual-review run vr-1: the person ran /visual-review to see the design of the change as a diagram.

Start 1 subagent with the Agent tool (subagent_type general-purpose, model sonnet). Give it the task below as its prompt, unchanged. Do not do the analysis yourself. When the subagent reports, answer the person in 1 line: the review page is ready, or why the analysis failed.

<task>
Analyze the design of a code change and send it to the tool mcp__visual-review__submit_model.

Repository: C:/work/shop
Base: origin/main (commit 540a818). Read the change with \`git diff 540a818\` in the repository; untracked files are new files.
Changed files (lines added and removed):
- src/Cart.cs (+12 -3)
- src/Basket.cs (+1 -1, renamed from src/OldBasket.cs)
- logo.png (binary, untracked)

Steps:
1. Load the tool: call ToolSearch with the query "select:mcp__visual-review__submit_model".
2. Read the diff and the changed files. Read an unchanged file only when a changed unit uses it or it uses a changed unit.
3. Call mcp__visual-review__submit_model with the whole design model and runId "vr-1".
4. If the result lists gaps, fix each gap and call the tool again with the whole model. When the result says that the model is accepted, report that in 1 line.

Rules that the tool schema cannot state:
- A unit is a class, interface, record or struct, enum, or module. A module is 1 file with code but no class; name it after the file.
- Each unit has 1 state: added, modified, deleted or context. A context unit did not change and is a direct neighbor of a changed unit; give it only id, name, kind, state, file and container.
- container is the namespace for C#, and the folder for TypeScript, JavaScript and Python.
- range is the first and the last line of the unit in the current file, or in the base file for a deleted unit. The first 5 lines of the range must contain the unit name. baseRange is the same for the base file, for a modified unit only.
- members lists only the members that changed. methods is the number of methods of the unit.
- summary is 1 to 3 sentences on what the unit does. cohesion is a score from 1 (unrelated responsibilities) to 5 (one responsibility) with a 1-sentence reason.
- A relation is inheritance, implementation, composition (the unit owns the other) or dependency (the unit uses the other), with the state added, removed or unchanged, between unit ids of the model.
- tables lists each database table that the change adds, modifies or drops, from EF Core migrations and DbContext, Prisma, TypeORM, Drizzle, .sql files, SQLAlchemy, Alembic and Django migrations. source is the changed file that makes the change; entity is the unit id of the entity class, if there is one.
- Each changed file with the extension .cs, .ts, .tsx, .js, .mjs, .cjs, .py, .sql, .prisma must be the file of a unit, the source of a table, or an entry of skippedFiles. Put generated files, such as *.Designer.cs and the EF Core model snapshot, in skippedFiles with the reason.
- Write paths relative to the repository with forward slashes, as in the list above.
</task>`

test('TC-13 FR-05 the analysis prompt names the run, the base, the files with their counts and the subagent model', () => {
  expect(analysisPrompt(RUN)).toBe(SONNET_PROMPT)
})

test('TC-13 FR-05 the analysis prompt changes only in the subagent line when analysisModel changes', () => {
  const agentLine = (text: string): string[] => text.split('\n').filter((line, index) => line !== SONNET_PROMPT.split('\n')[index])

  expect(agentLine(analysisPrompt({ ...RUN, model: 'opus' }))).toEqual([
    'Start 1 subagent with the Agent tool (subagent_type general-purpose, model opus). Give it the task below as its prompt, unchanged. Do not do the analysis yourself. When the subagent reports, answer the person in 1 line: the review page is ready, or why the analysis failed.',
  ])
  expect(agentLine(analysisPrompt({ ...RUN, model: 'haiku' }))).toEqual([
    'Start 1 subagent with the Agent tool (subagent_type general-purpose, model haiku). Give it the task below as its prompt, unchanged. Do not do the analysis yourself. When the subagent reports, answer the person in 1 line: the review page is ready, or why the analysis failed.',
  ])
  expect(agentLine(analysisPrompt({ ...RUN, model: 'inherit' }))).toEqual([
    'Start 1 subagent with the Agent tool (subagent_type general-purpose) and no model parameter, so it uses the model of this session. Give it the task below as its prompt, unchanged. Do not do the analysis yourself. When the subagent reports, answer the person in 1 line: the review page is ready, or why the analysis failed.',
  ])
})

test('TC-13 the submit_model description tells the model to send the whole model and fix the gaps', () => {
  expect(SUBMIT_DESCRIPTION).toBe(
    'Send the design model of a /visual-review run: the units, relations and database tables of the change. Send the whole model on each call. The result says that the model is accepted, or lists the gaps to fix before you call again.',
  )
})

const comment = (id: string, extra: Partial<Comment>): Comment => ({ id, anchor: { kind: 'unit', id: 'Shop.Cart' }, type: 'change', text: 'Split it.', status: 'draft', round: 2, ...extra })

/** A review with every grouping case: 3 anchors, 2 comments on 1 anchor, a multi-line text and a status change. */
const REVIEW: ReviewInput = {
  baseLabel: 'origin/main',
  drafts: [
    comment('1', { anchor: { kind: 'member', id: 'Shop.Cart#Add(Item)' }, type: 'question', text: 'Why not a set?\nOrder matters?' }),
    comment('2', {}),
    comment('3', { anchor: { kind: 'review', id: 'review' }, text: 'Good split overall.' }),
    comment('4', { type: 'question', text: 'Is it thread-safe?' }),
  ],
  changed: [comment('0', { status: 'resolved', round: 1, text: 'Rename Basket.' })],
}

test('TC-13 FR-19 the review prompt groups the comments by anchor with their type, lists status changes, and holds file changes until the person confirms', () => {
  expect(reviewPrompt(REVIEW)).toBe(
    [
      'visual-review: the person reviewed the design of the change against origin/main and sent 4 comments.',
      '',
      'Answer each question. For the change requests, propose a plan. Do not change any file until the person confirms the plan.',
      '',
      '## The whole review',
      '- Change request: Good split overall.',
      '',
      '## unit Shop.Cart',
      '- Change request: Split it.',
      '- Question: Is it thread-safe?',
      '',
      '## member Shop.Cart#Add(Item)',
      '- Question: Why not a set?',
      '    Order matters?',
      '',
      '## Status changes of earlier comments',
      '- Resolved: Change request on unit Shop.Cart: Rename Basket.',
    ].join('\n'),
  )
})

/** The formatter of the static page, which `web/review-text.js` puts on the global object. */
const { reviewText } = globalThis as unknown as { reviewText: (input: ReviewInput) => string }

const REVIEWS: readonly (readonly [string, ReviewInput])[] = [
  ['every grouping case', REVIEW],
  ['1 draft and no status change', { baseLabel: 'HEAD~1', drafts: [comment('5', { text: 'One.' })], changed: [] }],
  ['only a status change back to open', { baseLabel: 'main', drafts: [], changed: [comment('6', { status: 'open', anchor: { kind: 'relation', id: 'A→B→dependency' } })] }],
]

for (const [name, input] of REVIEWS) {
  test(`FR-24 Copy review on the static page copies the same text as the review prompt: ${name}`, () => {
    expect(reviewText(input)).toBe(reviewPrompt(input))
  })
}

test('an analysisModel value outside the options falls back to the default sonnet', () => {
  expect([analysisModelOf('haiku'), analysisModelOf('gpt'), analysisModelOf(undefined)]).toEqual(['haiku', 'sonnet', 'sonnet'])
})
