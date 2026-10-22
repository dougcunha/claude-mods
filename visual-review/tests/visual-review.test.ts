import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { SUBMIT_SCHEMA } from '../hooks/model'

type On = Parameters<TestBody>[1]
type Engine = Parameters<TestBody>[0]

const ROOT = '/work/shop'
const BASE = '540a81830da84d6bfb7a47bc4be3d229520b577b'
const SUBMIT_TOOL = 'mcp__visual-review__submit_model'
const CART_TS = ['import { Item } from "./item"', '', 'export class Cart {', '  items: Item[] = []', '}', ''].join('\n')

type Git = Record<string, { exitCode?: number; stdout?: string }>

/** A repository on `main` with one change against it. */
const REPO: Git = {
  'git rev-parse --show-toplevel': { stdout: `${ROOT}\n` },
  'git rev-parse --abbrev-ref HEAD': { stdout: 'feature\n' },
  'git rev-parse --verify --quiet main^{commit}': { stdout: `${BASE}\n` },
  'git merge-base HEAD main': { stdout: `${BASE}\n` },
  [`git diff --numstat -z -M ${BASE}`]: { stdout: '6\t0\tsrc/cart.ts\x00' },
  'git ls-files --others --exclude-standard -z': {},
  [`git -c core.quotePath=false diff -U0 --no-color -M --src-prefix=a/ --dst-prefix=b/ ${BASE}`]: { stdout: ['--- /dev/null', '+++ b/src/cart.ts', '@@ -0,0 +1,6 @@', ...CART_TS.split('\n').slice(0, 6).map(line => `+${line}`), ''].join('\n') },
}

type World = {
  registered: unknown[]
  tools: unknown[]
  prompts: string[]
  statuses: (string | undefined)[]
  toasts: string[]
  written: [string, string][]
  spawned: string[][]
  /** How many page servers ended because the mod left their read loop. */
  serversEnded: number[]
  clock: ReturnType<typeof mock.clock>
}

/** The page URL the fake server prints. */
const PAGE_URL = `http://127.0.0.1:52811/?t=${'0123456789abcdef'.repeat(4)}`

/** The page file the mod ships, cut to the lines the static page rewrites. */
const PAGE_HTML = ['<link rel="stylesheet" href="style.css?t=__REVIEW_TOKEN__" />', '<script src="app.js?t=__REVIEW_TOKEN__"></script>'].join('\n')

/**
 * The engine beneath the mod: Git answers from `git` (exit code 128 for any other argv) or cannot start, the working
 * tree holds `src/cart.ts`, a submitted prompt enters or is dropped with `drop`, and `node` starts a page server that
 * prints its URL, says 1 tab connected, then ticks each second. With `isNodeMissing`, `node --version` cannot start;
 * with `isServerFailing`, Node.js runs but the server ends before its URL; with `isToolRefused`, the tool does not
 * register; with `isWriteFailing`, no file can be written; `reviewDrop` drops only review prompts. Every prompt, status, toast and spawned argv
 * is recorded.
 */
function world(
  on: On,
  {
    git = REPO,
    drop,
    isNodeMissing = false,
    isServerFailing = false,
    isToolRefused = false,
    isWriteFailing = false,
    reviewDrop,
    serverLines = [],
  }: {
    git?: Git | 'missing'
    drop?: string
    isNodeMissing?: boolean
    isServerFailing?: boolean
    isToolRefused?: boolean
    isWriteFailing?: boolean
    reviewDrop?: string
    serverLines?: readonly string[]
  } = {},
): World {
  const state = {
    registered: [] as unknown[],
    tools: [] as unknown[],
    prompts: [] as string[],
    statuses: [] as (string | undefined)[],
    toasts: [] as string[],
    written: [] as [string, string][],
    spawned: [] as string[][],
    serversEnded: [] as number[],
  }
  const clock = mock.clock(on)
  mock.store(on, {})
  on('process.spawn', async function* (_: unknown, e: { argv: readonly string[] }) {
    state.spawned.push([...e.argv])
    if (e.argv[0] !== 'node') return { value: { code: 0, signal: null } }
    if (isServerFailing) throw new Error('EADDRINUSE')
    try {
      yield { stream: 'stdout', text: `{"type":"ready","url":"${PAGE_URL}"}\n` }
      yield { stream: 'stdout', text: '{"type":"clients","count":1}\n' }
      for (const line of serverLines) yield { stream: 'stdout', text: `${line}\n` }
      for (let tick = 0; tick < 60; tick++) {
        await clock.sleep(1_000)
        yield { stream: 'stdout', text: '{"type":"tick"}\n' }
      }
    } finally {
      state.serversEnded.push(1)
    }

    return { value: { code: 0, signal: null } }
  } as never)
  mock.env(on, { TEMP: 'C:\\Temp' })
  on('session.id', async () => ({ value: 's-1' }))
  on('fs.write', async (_, e) => {
    if (isWriteFailing) throw new Error('disk full')

    return (state.written.push([e.path, e.text]), { value: undefined }) as never
  })
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', async () => ({ value: ROOT }))
  on('command.register', async (_, e) => (state.registered.push(e), { value: { command: e.name } }))
  on('tool.register', async (_, e) => {
    if (isToolRefused) throw new Error('refused')

    return (state.tools.push(e), { value: { tool: `mcp__visual-review__${e.name}` } }) as never
  })
  on('prompt.submit', async (_, e) => {
    state.prompts.push(e.text)
    const dropped = drop ?? (e.text.startsWith('visual-review: the person reviewed') ? reviewDrop : undefined)

    return (dropped === undefined ? { text: e.text } : { drop: dropped }) as never
  })
  on('ui.status', async (_, e) => (state.statuses.push(e.text), { value: undefined }) as never)
  on('ui.toast', async (_, e) => (state.toasts.push(e.text), { value: undefined }) as never)
  on('session.end', async (_, e) => ({ sessionId: e.sessionId }) as never)
  on('turn.start', async (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  on('fs.read', async (_, e) => {
    const written = state.written.filter(([path]) => path.replace(/\\/g, '/') === e.path.replace(/\\/g, '/')).at(-1)
    if (written !== undefined) return { value: written[1] } as never
    if (e.path.replace(/\\/g, '/').endsWith('/web/index.html')) return { value: PAGE_HTML } as never
    if (e.path !== `${ROOT}/src/cart.ts`) throw new Error('missing')

    return { value: CART_TS } as never
  })
  on('process.run', async (_, e) => {
    if (e.argv[0] === 'node') {
      if (isNodeMissing) throw new Error('spawn node ENOENT')

      return { value: { exitCode: 0, stdout: 'v24.20.0\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (git === 'missing') throw new Error('git was not found on the PATH')
    const answer = git[e.argv.join(' ')]

    return { value: { exitCode: answer?.exitCode ?? (answer === undefined ? 128 : 0), stdout: answer?.stdout ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  return { ...state, clock }
}

const run = async ($: Engine, args: string): Promise<string | undefined> => ((await $.command.run({ command: 'visual-review', args } as never)) as { text?: string }).text

const runIdOf = (prompt: string | undefined): string => /^visual-review run (\S+):/.exec(prompt ?? '')?.[1] ?? ''

const submit = async ($: Engine, input: Record<string, unknown>): Promise<unknown> => ((await $.tool.call({ tool: SUBMIT_TOOL, ...input } as never)) as { result?: unknown }).result

const NO_RUN = 'No visual review waits for a model. Stop, and tell the person to run /visual-review.'
const ACCEPTED = 'The model is accepted, and the review page is open in the browser. Report in 1 line that the review page is ready.'
const ANALYZING = 'Analyzing the design of the change…'

/** A valid model of the change in REPO: 1 added class of `src/cart.ts` and its context neighbor. */
const validModel = (runId: string): Record<string, unknown> => ({
  runId,
  units: [
    {
      id: 'src/cart.Cart',
      name: 'Cart',
      kind: 'class',
      state: 'added',
      file: 'src/cart.ts',
      container: 'src',
      range: { start: 3, end: 5 },
      methods: 0,
      summary: 'Holds the items of an order.',
      cohesion: { score: 5, reason: 'One responsibility.' },
    },
    { id: 'src/item.Item', name: 'Item', kind: 'class', state: 'context', file: 'src/item.ts', container: 'src' },
  ],
  relations: [{ from: 'src/cart.Cart', to: 'src/item.Item', kind: 'composition', state: 'added' }],
  tables: [],
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`TC-01 the session start registers /visual-review with its [base] hint, not immediate, and the deferred tool (${surface})`, async ($, on) => {
    const { registered, tools } = world(on)

    await $.session.start({ cwd: ROOT, surface, isInteractive: true })

    expect(registered).toEqual([
      { name: 'visual-review', description: 'Open a visual design review of the changes against a base branch or reference', argumentHint: '[base]' },
    ])
    expect(tools).toEqual([
      {
        name: 'submit_model',
        description:
          'Send the design model of a /visual-review run: the units, relations and database tables of the change. Send the whole model on each call. The result says that the model is accepted, or lists the gaps to fix before you call again.',
        inputSchema: SUBMIT_SCHEMA,
        isDeferred: true,
      },
    ])
  })
}

const STOPS = [
  ['FR-04 outside a repository', {}, '', 'visual-review needs a Git repository.'],
  ['FR-03 with an unknown reference', REPO, 'nope', 'Unknown Git reference: nope.'],
  ['FR-04 with an empty diff', { ...REPO, [`git diff --numstat -z -M ${BASE}`]: {} }, '', 'No changes against main.'],
] as const

for (const [name, git, args, text] of STOPS) {
  test(`TC-03 ${name}, the command answers why and sends no prompt`, async ($, on) => {
    const { prompts, statuses, clock } = world(on, { git })

    expect(await run($, args)).toBe(text)
    await clock.settle()

    expect(prompts).toEqual([])
    expect(statuses).toEqual([])
  })
}

test('FR-02 NFR-10 with changes, the command shows the status and submits 1 analysis prompt for its run, with the default analysisModel sonnet', async ($, on) => {
  const { prompts, statuses, toasts, clock } = world(on)

  expect(await run($, '  ')).toBe('Analyzing the design of 1 changed file against main.')
  await clock.settle()

  expect(toasts).toEqual([])
  expect(statuses).toEqual([ANALYZING])
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toContain('- src/cart.ts (+6 -0)')
  expect(runIdOf(prompts[0])).toMatch(/^vr-/)
  expect(prompts[0]).toContain('(subagent_type general-purpose, model sonnet)')
})

test('FR-05 the analysisModel option reaches the analysis prompt through register', { options: { analysisModel: 'opus' } }, async ($, on) => {
  const { prompts, clock } = world(on)

  await run($, '')
  await clock.settle()

  expect(prompts[0]).toContain('(subagent_type general-purpose, model opus)')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`TC-03 when the tool did not register, the command says the tool is missing and sends no prompt (${surface})`, async ($, on) => {
    const { prompts, statuses, toasts, clock } = world(on, { isToolRefused: true })
    await $.session.start({ cwd: ROOT, surface, isInteractive: true })

    expect(await run($, '')).toBe('visual-review: the submit_model tool is missing, so the analysis cannot send its model. Run /reload-plugins, then /visual-review again.')
    await clock.settle()

    expect([prompts, statuses]).toEqual([[], []])
    expect(toasts).toEqual([expect.stringMatching(/^visual-review: the submit_model tool did not register: /)])
  })
}

test('a run whose state write fails answers with the cause, and leaves no run, status or prompt', async ($, on) => {
  const { prompts, statuses, clock } = world(on)
  // A hook that throws is skipped and the write lands, so the refusal is a deny.
  on('state.set', async () => ({ deny: 'state refused' }) as never)

  expect(await run($, '')).toMatch(/^visual-review: /)
  await clock.settle()

  expect(prompts).toEqual([])
  expect(statuses.filter(status => status !== undefined)).toEqual([])
})

test('a Git that cannot start answers with the cause instead of no answer', async ($, on) => {
  world(on, { git: 'missing' })

  // The kit turns the thrown error into a missing process.run, whose message names the call.
  expect(await run($, '')).toMatch(/^visual-review: .*process\.run/)
})

test('TC-06 FR-06 a model that leaves out the changed file gets the gap, and the run keeps waiting', async ($, on) => {
  const { prompts, statuses, clock } = world(on)
  await run($, '')
  await clock.settle()

  const result = await submit($, { runId: runIdOf(prompts[0]), units: [], relations: [], tables: [] })

  expect(result).toBe(
    'The model is not accepted. Fix these 1 gaps and call submit_model again with the whole model:\n' +
      '- src/cart.ts: the changed file is not covered; add its units, the table it changes, or a skippedFiles entry',
  )
  expect(statuses).toEqual([ANALYZING])
})

test('TC-06 a valid model is accepted and written to view.json in the session folder, and the run and the status clear', async ($, on) => {
  const { prompts, statuses, written, clock } = world(on)
  await run($, '')
  await clock.settle()
  const runId = runIdOf(prompts[0])

  expect(await submit($, validModel(runId))).toBe(ACCEPTED)
  // The engine hands fs.write the path in the platform's own form.
  expect(written.map(([path]) => path.replace(/\\/g, '/'))).toEqual(['C:/Temp/claude-visual-review/s-1/view.json'])
  expect(JSON.parse(written[0]?.[1] ?? '{}')).toMatchObject({ version: 1, runId, notice: null, units: [{ id: 'src/cart.Cart', added: 3, removed: 0, ce: 1 }, { id: 'src/item.Item', ca: 1 }] })
  expect(statuses).toEqual([ANALYZING, undefined])
  expect(await submit($, validModel(runId))).toBe(NO_RUN)
})

test('a submit_model call whose work fails answers the cause as its result and never denies the call', async ($, on) => {
  const state = world(on, { isWriteFailing: true })

  const result = await review($, state)

  // The kit turns the thrown error into a missing fs.write; a real run reads the write error.
  expect(result).toMatch(/^visual-review failed: .*fs\.write/)
})

test('TC-06 a call with an old run id gets the replaced result, and a call with no run asks for /visual-review', async ($, on) => {
  const { prompts, clock } = world(on)

  expect(await submit($, validModel('vr-0'))).toBe(NO_RUN)
  await run($, '')
  await clock.settle()

  expect(await submit($, validModel(`${runIdOf(prompts[0])}-old`))).toBe('This analysis was replaced by a newer /visual-review run. Stop, and report that in 1 line.')
})

test('TC-15 FR-25 the analysis turn that ends with no model clears the status and names the cause; another turn changes nothing', async ($, on) => {
  const { prompts, statuses, toasts, clock } = world(on)
  await run($, '')
  await clock.settle()
  const runId = runIdOf(prompts[0])
  await $.turn.start({ text: 'Fix the README typo.', turnId: 't-other' })
  await $.turn.start({ text: prompts[0] ?? '', turnId: 't-analysis' })

  await $.turn.complete({ answer: '', durationMs: 1_000, isAborted: false, turnId: 't-other', reason: 'answer' })
  expect(toasts).toEqual([])
  await $.turn.complete({ answer: '', durationMs: 1_000, isAborted: true, turnId: 't-analysis', reason: 'aborted' })

  expect(statuses).toEqual([ANALYZING, undefined])
  expect(toasts).toEqual(['visual-review: the design analysis failed: the turn was interrupted with no design model. Run /visual-review again.'])
  expect(await submit($, validModel(runId))).toBe(NO_RUN)
})

test('TC-15 FR-25 an analysis prompt that a hook drops clears the status and says why', async ($, on) => {
  const { statuses, toasts, clock } = world(on, { drop: 'held by a guard' })

  await run($, '')
  await clock.settle()

  expect(statuses).toEqual([ANALYZING, undefined])
  expect(toasts).toEqual(['visual-review: the design analysis failed: the prompt did not enter the session (held by a guard).'])
})

/** Runs /visual-review and sends the valid model of its run; returns the tool result. */
async function review($: Engine, state: World): Promise<unknown> {
  const before = state.prompts.length
  await run($, '')
  await state.clock.settle()

  return submit($, validModel(runIdOf(state.prompts[before])))
}

test('FR-21 DEC-02 the first accepted model starts 1 page server and opens the browser; a second run with the tab open opens neither', async ($, on) => {
  const state = world(on)

  expect(await review($, state)).toBe(ACCEPTED)
  await state.clock.settle()
  expect(await review($, state)).toBe(ACCEPTED)

  expect(state.spawned.map(argv => argv[0])).toEqual(['node', 'xdg-open'])
  expect(state.spawned[0]?.slice(2)).toEqual(['--dir', 'C:/Temp/claude-visual-review/s-1', '--web', expect.stringMatching(/\/web$/)])
  expect(state.spawned[1]).toEqual(['xdg-open', PAGE_URL])
  expect(state.toasts).toEqual([`visual-review: Visual review ready: ${PAGE_URL}`, `visual-review: Visual review updated in the open tab: ${PAGE_URL}`])
})

test('NFR-06 the session end stops the page server at its next line, and the next run starts a new one', async ($, on) => {
  const state = world(on)
  await review($, state)
  await state.clock.settle()

  await $.session.end({ reason: 'clear', sessionId: 's-1', resume: { id: 's-1' } } as never)
  await state.clock.advance(1_000)
  await state.clock.settle()

  expect(state.serversEnded).toEqual([1])
  await review($, state)
  expect(state.spawned.filter(argv => argv[0] === 'node')).toHaveLength(2)
})

const STATIC = 'The model is accepted, and a static review page is open in the browser, because the page server is not available. Report in 1 line that the review page is ready as a static page, where the person copies the review with Copy review.'
const STATIC_PAGE_URL = 'file:///C:/Temp/claude-visual-review/s-1/review.html'
const STATIC_TOAST_END = `. The page is static: use Copy review to send the comments. Page: ${STATIC_PAGE_URL}`

test('TC-17 FR-24 with no Node.js, the mod writes view.js and review.html, opens the static page and says why', async ($, on) => {
  const state = world(on, { isNodeMissing: true })

  expect(await review($, state)).toBe(STATIC)

  const files = new Map(state.written.map(([path, text]) => [path.replace(/\\/g, '/'), text]))
  expect([...files.keys()]).toEqual(['C:/Temp/claude-visual-review/s-1/view.json', 'C:/Temp/claude-visual-review/s-1/view.js', 'C:/Temp/claude-visual-review/s-1/review.html'])
  expect(files.get('C:/Temp/claude-visual-review/s-1/view.js')).toBe(`window.VIEW = ${files.get('C:/Temp/claude-visual-review/s-1/view.json')}\n`)
  expect(files.get('C:/Temp/claude-visual-review/s-1/review.html')).toMatch(
    /^<link rel="stylesheet" href="file:\/\/\/\S+\/web\/style\.css" \/>\n<script src="view\.js"><\/script>\n {4}<script src="file:\/\/\/\S+\/web\/app\.js"><\/script>$/,
  )
  expect(state.spawned).toEqual([['xdg-open', STATIC_PAGE_URL]])
  expect(state.toasts).toEqual([`visual-review: Node.js not found${STATIC_TOAST_END}`])
})

test('FR-24 a page server that ends before its URL falls back to the static page and names the cause', async ($, on) => {
  const state = world(on, { isServerFailing: true })

  expect(await review($, state)).toBe(STATIC)

  expect(state.spawned.map(argv => argv[0])).toEqual(['node', 'xdg-open'])
  expect(state.spawned[1]).toEqual(['xdg-open', STATIC_PAGE_URL])
  // The kit turns the thrown error into a missing process.spawn; a real run reads the server's error, such as EADDRINUSE.
  expect(state.toasts).toEqual([expect.stringMatching(/^visual-review: the page server failed: .*process\.spawn/)])
  expect(state.toasts[0]?.endsWith(STATIC_TOAST_END)).toBe(true)
})

test('TC-14 FR-19 FR-20 a comments line then a submit line send 1 review prompt, and the drafts come back open in view.json', async ($, on) => {
  const draft = { id: 'c1', anchor: { kind: 'unit', id: 'src/cart.Cart' }, type: 'question', text: 'Why a list?', status: 'draft', round: 1 }
  const state = world(on, { serverLines: [JSON.stringify({ type: 'comments', comments: [draft] }), '{"type":"submit"}'] })

  await review($, state)
  await state.clock.settle()

  expect(state.prompts[1]).toBe(
    [
      'visual-review: the person reviewed the design of the change against main and sent 1 comment.',
      '',
      'Answer each question. For the change requests, propose a plan. Do not change any file until the person confirms the plan.',
      '',
      '## unit src/cart.Cart',
      '- Question: Why a list?',
    ].join('\n'),
  )
  const last = JSON.parse(state.written.at(-1)?.[1] ?? '{}') as { round: number; comments: { id: string; status: string; isAnchored: boolean }[] }
  expect([last.round, last.comments.map(comment => [comment.id, comment.status, comment.isAnchored])]).toEqual([2, [['c1', 'open', true]]])
  expect(noticeOf(state)).toBe(null)
})

test('TC-14 OBJ-03 a comment set sent while the submit waited keeps 1 open comment and the new draft, and reaches the page', async ($, on) => {
  const draft = (id: string): Record<string, unknown> => ({ id, anchor: { kind: 'unit', id: 'src/cart.Cart' }, type: 'question', text: `Why ${id}?`, status: 'draft', round: 1 })
  const lines = [{ type: 'comments', comments: [draft('x')] }, { type: 'submit' }, { type: 'comments', comments: [draft('x'), draft('y')] }]
  const state = world(on, { serverLines: lines.map(line => JSON.stringify(line)) })

  await review($, state)
  await state.clock.settle()

  const last = JSON.parse(state.written.at(-1)?.[1] ?? '{}') as { comments: { id: string; status: string; round: number }[] }
  expect(state.prompts).toHaveLength(2)
  expect(last.comments.map(comment => [comment.id, comment.status, comment.round])).toEqual([
    ['x', 'open', 1],
    ['y', 'draft', 2],
  ])
})

test('a submit line with nothing new sends no prompt and says so', async ($, on) => {
  const state = world(on, { serverLines: ['{"type":"submit"}'] })

  await review($, state)
  await state.clock.settle()

  expect(state.prompts).toHaveLength(1)
  expect(state.toasts.at(-1)).toBe('visual-review: the review has no new comment and no status change to send.')
  expect(noticeOf(state)).toBe('The review has no new comment and no status change to send.')
})

test('FR-20 a review prompt that is dropped keeps the round and its drafts, and tells the page why', async ($, on) => {
  const draft = { id: 'c1', anchor: { kind: 'unit', id: 'src/cart.Cart' }, type: 'question', text: 'Why a list?', status: 'draft', round: 1 }
  const state = world(on, { reviewDrop: 'held by a guard', serverLines: [JSON.stringify({ type: 'comments', comments: [draft] }), '{"type":"submit"}'] })

  await review($, state)
  await state.clock.settle()

  const last = JSON.parse(state.written.at(-1)?.[1] ?? '{}') as { round: number; comments: { status: string }[] }
  expect([last.round, last.comments.map(comment => comment.status)]).toEqual([1, ['draft']])
  expect(noticeOf(state)).toBe('The review was not sent: held by a guard. Your comments are kept; submit again.')
})

/** The notice text of the last view.json the mod wrote, or null. */
function noticeOf(state: World): string | null {
  const last = JSON.parse(state.written.at(-1)?.[1] ?? '{}') as { notice?: { text: string } | null }

  return last.notice?.text ?? null
}
