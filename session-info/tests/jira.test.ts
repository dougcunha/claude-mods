import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { errorText, issueDetail, issueKeys, mention, needsRead, readIssue, readSite, serverNames, siteSetting, statusColor, toKeyPattern } from '../hooks/jira'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 80 },
} as const

const SITE = 'https://example.atlassian.net'
const TOOL = 'mcp__plugin_atlassian_atlassian__getJiraIssue'

const issueJson = (key: string) =>
  JSON.stringify({
    data: {
      key,
      fields: {
        summary: 'Fix the login timeout',
        status: { name: 'In test' },
        assignee: { displayName: 'Ana Souza' },
        priority: { name: 'P3' },
        updated: '2026-10-12T16:34:51.425-0300',
      },
    },
  })

const text = (body: string, isError = false) => ({ content: [{ type: 'text', text: body }], isError })

/** What the issue buttons asked the system to open, per test. */
let opened: string[][] = []

const pane = (on: Parameters<TestBody>[1], tools: string[], calls: { server: string; tool: string; args: Record<string, unknown> }[] = [], refusal?: string) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('env.get', async () => ({ value: undefined }))
  on('process.spawn', async function* (_, e) {
    opened.push([...e.argv])

    return { value: { code: 0, signal: null } }
  })
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200_000 } } }) as never)
  on('process.run', async () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.submit', async (_, e) => ({ text: e.text }))
  on('tool.list', async () => ({ value: tools.map(name => ({ name, description: '', mcp: true })) }))
  on('mcp.call', async (_, e) => {
    calls.push({ server: e.server, tool: e.tool, args: e.args })
    if (refusal !== undefined) return { deny: refusal } as never
    // The engine knows a plugin's server by its /mcp name alone.
    if (e.server !== 'plugin:atlassian:atlassian') throw new Error(`no MCP server named ${e.server}`)
    if (e.tool === 'getAccessibleAtlassianResources')
      return { value: text(JSON.stringify({ data: { resources: [{ cloudId: 'c1', url: SITE, products: [{ id: 'jira' }] }] } })) }
    const key = String(e.args.issueIdOrKey)

    return { value: key === 'WIN-404' ? text('Issue does not exist or you do not have permission to see it.', true) : text(issueJson(key)) }
  })
}

const OPTIONS = { options: { jiraKeyPattern: 'WIN-\\d+' } }

const later = (ms: number) =>
  new Promise<void>(resolve => (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => void }).setTimeout(resolve, ms))

/** The issue reads run on after the hook returns: the pane is mounted again until the read lands. */
async function mountRead($: Parameters<TestBody>[0], surface: 'terminal' | 'desktop', done: RegExp | string) {
  for (let tries = 0; ; tries++) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (tries === 50 || (await ui.find({ type: 'Text', text: done }))) return ui
    await ui.unmount()
    await later(20)
  }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a key the chat mentions shows its issue from the Atlassian MCP server (${surface})`, OPTIONS, async ($, on) => {
    const calls: { server: string; tool: string; args: Record<string, unknown> }[] = []
    pane(on, [TOOL], calls)

    await $.prompt.submit({ text: 'Look at WIN-3159 and the UTF-8 issue' } as never)
    const ui = await mountRead($, surface, 'In test')
    expect(await ui.find({ type: 'Text', text: ' · Fix the login timeout' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'In test' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ {2}P3 · Ana Souza · updated \S+ ago$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /browse/ })).toBeUndefined()
    opened = []
    await ui.press({ key: 'jira:WIN-3159' })
    expect(opened).toEqual([['xdg-open', `${SITE}/browse/WIN-3159`]])
    await ui.unmount()

    expect(calls.map(call => call.tool)).toEqual(['getAccessibleAtlassianResources', 'getJiraIssue'])
    expect(calls[1]).toMatchObject({ server: 'plugin:atlassian:atlassian', args: { cloudId: 'c1', issueIdOrKey: 'WIN-3159' } })

    await $.prompt.submit({ text: 'WIN-3159 again' } as never)
    expect(calls.length).toBe(2)
  })
}

test('an issue the server cannot read shows the error', { options: { jiraKeyPattern: 'WIN-\\d+', jiraSite: SITE } }, async ($, on) => {
  const calls: { server: string; tool: string; args: Record<string, unknown> }[] = []
  pane(on, [TOOL], calls)

  await $.prompt.submit({ text: 'WIN-404' } as never)
  const ui = await mountRead($, 'terminal', /Issue does not exist/)
  expect(await ui.find({ type: 'Text', text: '  Issue does not exist or you do not have permission to see it.' })).toBeDefined()
  await ui.unmount()
  expect(calls.map(call => call.tool)).toEqual(['getJiraIssue'])
  expect(calls[0]?.args.cloudId).toBe(SITE)
})

test('without an Atlassian MCP server the section stays hidden', OPTIONS, async ($, on) => {
  pane(on, ['mcp__other__tool'])
  await $.prompt.submit({ text: 'hello' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Jira/ })).toBeUndefined()
  await ui.unmount()
})

test('with no key pattern the section says how to set one, and the model reading an issue shows its answer', async ($, on) => {
  const calls: { server: string; tool: string; args: Record<string, unknown> }[] = []
  pane(on, [TOOL], calls)
  on('tool.call', { tool: TOOL }, async (_, e) => ({ result: {}, text: issueJson(String((e as Record<string, unknown>).issueIdOrKey)) }) as never)
  await $.prompt.submit({ text: 'WIN-3159' } as never)

  const empty = await mountRead($, 'terminal', /^No issue mentioned yet/)
  expect(await empty.find({ type: 'Text', text: 'No issue mentioned yet. Set jiraKeyPattern to find issue keys in the chat.' })).toBeDefined()
  await empty.unmount()

  await $.tool.call({ tool: TOOL, cloudId: SITE, issueIdOrKey: 'win-3159' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: ' · Fix the login timeout' })).toBeDefined()
  opened = []
  await ui.press({ key: 'jira:WIN-3159' })
  expect(opened).toEqual([['xdg-open', `${SITE}/browse/WIN-3159`]])
  await ui.unmount()
  // The model's answer is the read: the mod makes no call of its own, so it needs no permission.
  expect(calls).toEqual([])
})

test('a read the engine refuses goes to the transcript whole', { options: { jiraKeyPattern: 'WIN-\\d+', jiraSite: SITE } }, async ($, on) => {
  const logged: string[] = []
  pane(on, [TOOL], [], 'The safety check denied this call')
  on('ui.log', async (_, e) => (logged.push(String(e.text)), { value: undefined }) as never)

  await $.prompt.submit({ text: 'WIN-3159' } as never)
  const ui = await mountRead($, 'terminal', /denied/)
  expect(await ui.find({ type: 'Text', text: /^ {2}.*The safety check denied this call$/ })).toBeDefined()
  await ui.unmount()
  expect(logged.some(line => line.startsWith('session-info: Jira WIN-3159: ') && line.endsWith('The safety check denied this call'))).toBe(true)
})

const VERDICT = `The server-side auto mode classifier gave no verdict for ${TOOL}: the request did not ask for one.`

for (const allow of [[], [TOOL], ['mcp__plugin_atlassian_atlassian']]) {
  test(`a refused read offers to allow the tool until a rule covers it (${allow.join(', ') || 'no rule'})`, { options: { jiraKeyPattern: 'WIN-\\d+', jiraSite: SITE } }, async ($, on) => {
    const filled: string[] = []
    const copied: string[] = []
    pane(on, [TOOL], [], VERDICT)
    on('settings.read', async () => ({ value: { permissions: { allow } } }) as never)
    on('prompt.fill', async (_, e) => (filled.push(e.text), { isFilled: true }) as never)
    on('ui.log', async () => ({ value: undefined }) as never)
    on('ui.copy', async (_, e) => (copied.push(e.text), { value: { isCopied: true } }) as never)
    on('ui.toast', async () => ({ value: undefined }))

    await $.prompt.submit({ text: 'WIN-3159' } as never)
    const ui = await mountRead($, 'terminal', /Auto mode cannot approve/)
    expect(await ui.find({ type: 'Text', text: `  Auto mode cannot approve the mod's read: allow ${TOOL} in permissions.` })).toBeDefined()
    if (allow.length > 0) {
      expect(await ui.find({ type: 'Text', text: 'Allow reads' })).toBeUndefined()
      await ui.unmount()

      return
    }
    await ui.press({ key: 'jira-allow:WIN-3159' })
    await ui.press({ key: 'jira-copy:WIN-3159' })
    await ui.unmount()
    expect(filled).toEqual([`Add "${TOOL}" to permissions.allow in ~/.claude/settings.json, so the session-info mod can read Jira issues.`])
    expect(copied).toEqual([TOOL])
  })
}

test('keys come from the pattern and from browse links, once each', async () => {
  const pattern = toKeyPattern('WIN-\\d+')
  expect(issueKeys('WIN-1, WIN-1 and https://x.atlassian.net/browse/ABC-12 but not XWIN-2 or UTF-8', pattern)).toEqual(['ABC-12', 'WIN-1'])
  expect(issueKeys('WIN-1', undefined)).toEqual([])
  expect(toKeyPattern('(')).toBeUndefined()
  expect(toKeyPattern('')).toBeUndefined()
})

test('issues read, fail and stay fresh for a few minutes', async () => {
  const listed = mention(mention([], 'WIN-1', 1), 'WIN-2', 2)
  expect(listed.map(issue => issue.key)).toEqual(['WIN-2', 'WIN-1'])
  const read = readIssue({ key: 'WIN-1', at: 1 }, text(issueJson('WIN-1')), 10)
  expect(read).toMatchObject({ summary: 'Fix the login timeout', status: 'In test', priority: 'P3', assignee: 'Ana Souza', readAt: 10 })
  expect(mention([read], 'WIN-1', 20)[0]?.summary).toBe('Fix the login timeout')
  expect(needsRead(read, 10 + 60_000)).toBe(false)
  expect(needsRead(read, 10 + 600_000)).toBe(true)
  expect(readIssue({ key: 'WIN-1', at: 1 }, text('{"error":"Not found"}'), 10).error).toBe('Not found')
  expect(issueDetail({ key: 'WIN-1', at: 1 }, 0)).toBe('Reading…')
  expect(readSite(text('nope'))).toBeUndefined()
  expect(siteSetting(' https://x.atlassian.net/ ')).toEqual({ cloudId: 'https://x.atlassian.net', url: 'https://x.atlassian.net' })
  expect(siteSetting('uuid-1')).toEqual({ cloudId: 'uuid-1' })
  expect(statusColor('Done')).toBe('success')
  expect(statusColor('Em andamento')).toBe('suggestion')
  expect(statusColor('To Do')).toBe('inactive')
  expect(needsRead({ ...read, error: 'Not found' }, 11)).toBe(true)
})

test('a server goes by its /mcp names before the spelling of its tools', async () => {
  expect(serverNames('plugin_atlassian_atlassian')).toEqual(['plugin:atlassian:atlassian', 'plugin_atlassian_atlassian'])
  expect(serverNames('plugin_my_tools_jira')).toEqual(['plugin:my:tools_jira', 'plugin:my_tools:jira', 'plugin_my_tools_jira'])
  expect(serverNames('claude_ai_Atlassian_Rovo')).toEqual(['claude.ai Atlassian Rovo', 'claude_ai_Atlassian_Rovo'])
  expect(serverNames('jira')).toEqual(['jira'])
  expect(errorText(new Error('HooksError: session-info: $.mcp.call(x) failed\nstack'))).toBe('$.mcp.call(x) failed')
  const verdict =
    'session-info: $.mcp.call(plugin:atlassian:atlassian, getJiraIssue) refused: The server-side auto mode classifier gave no verdict for mcp__plugin_atlassian_atlassian__getJiraIssue: the request did not ask for one.'
  expect(errorText(new Error(verdict))).toBe("Auto mode cannot approve the mod's read: allow mcp__plugin_atlassian_atlassian__getJiraIssue in permissions.")
})
