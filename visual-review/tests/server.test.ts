import { expect, test } from 'claude-code/testing'

import type { Host } from '../hooks/host'
import { fileUrl } from '../hooks/paths'
import { browserArgv, pageModeOf, parseServerLine, platformOf, serverArgv, splitLines, staticPageOf, staticViewOf } from '../hooks/server'

const URL = `http://127.0.0.1:52811/?t=${'0123456789abcdef'.repeat(4)}`

test('TC-16 server lines split across chunks come out whole, and a cut line waits for the next chunk', () => {
  const first = splitLines('', '{"type":"tick"}\r\n{"type":"rea')
  const second = splitLines(first.rest, `dy","url":"${URL}"}\n\n`)

  expect(first).toEqual({ lines: ['{"type":"tick"}'], rest: '{"type":"rea' })
  expect(second).toEqual({ lines: [`{"type":"ready","url":"${URL}"}`], rest: '' })
})

const LINES = [
  ['a ready line with a loopback URL and a token', `{"type":"ready","url":"${URL}"}`, { type: 'ready', url: URL }],
  ['an error line', '{"type":"error","message":"EADDRINUSE"}', { type: 'error', message: 'EADDRINUSE' }],
  ['a clients line', '{"type":"clients","count":2}', { type: 'clients', count: 2 }],
  ['a ready line with another host', `{"type":"ready","url":"${URL.replace('127.0.0.1', '0.0.0.0')}"}`, null],
  ['a ready line with no token', '{"type":"ready","url":"http://127.0.0.1:52811/"}', null],
  ['a negative client count', '{"type":"clients","count":-1}', null],
  ['an unknown type', '{"type":"debug","message":"x"}', null],
  ['a line that is not JSON', 'Debugger attached.', null],
] as const

for (const [name, line, expected] of LINES) {
  test(`TC-16 the server line parser reads ${name}`, () => {
    expect(parseServerLine(line)).toEqual(expected)
  })
}

test('TC-17 the server starts with Node.js, the shipped server file, the session folder and the page folder, with forward slashes', () => {
  expect(serverArgv('C:\\Users\\Ana Maria\\.claude\\plugins\\visual-review\\', 'C:/Temp/claude-visual-review/s-1')).toEqual([
    'node',
    'C:/Users/Ana Maria/.claude/plugins/visual-review/server/server.mjs',
    '--dir',
    'C:/Temp/claude-visual-review/s-1',
    '--web',
    'C:/Users/Ana Maria/.claude/plugins/visual-review/web',
  ])
})

test('TC-17 NFR-08 the browser opens through the URL protocol handler on Windows, open on macOS and xdg-open on Linux', () => {
  expect([browserArgv('windows', URL), browserArgv('mac', URL), browserArgv('linux', URL)]).toEqual([
    ['rundll32', 'url.dll,FileProtocolHandler', URL],
    ['open', URL],
    ['xdg-open', URL],
  ])
})

const NODE_RUNS = [
  ['Node.js answers its version', { exitCode: 0, stdout: 'v24.20.0\r\n' }, 'server'],
  ['node --version cannot start', null, 'static'],
  ['node --version fails', { exitCode: 1, stdout: '' }, 'static'],
  ['another program named node answers', { exitCode: 0, stdout: 'node 1.0' }, 'static'],
] as const

for (const [name, run, expected] of NODE_RUNS) {
  test(`TC-17 FR-24 the page mode is ${expected} when ${name}`, () => {
    expect(pageModeOf(run)).toBe(expected)
  })
}

test('TC-17 FR-24 the static page loads the page files by file URL with no token, and view.js before them', () => {
  const page = [
    '<link rel="icon" href="data:," />',
    '<link rel="stylesheet" href="style.css?t=__REVIEW_TOKEN__" />',
    '<script src="vendor/elk.bundled.js?t=__REVIEW_TOKEN__"></script>',
    '<script src="app.js?t=__REVIEW_TOKEN__"></script>',
  ].join('\n')

  expect(staticPageOf(page, 'file:///C:/Users/Ana%20Maria/visual-review/web/')).toBe(
    [
      '<link rel="icon" href="data:," />',
      '<link rel="stylesheet" href="file:///C:/Users/Ana%20Maria/visual-review/web/style.css" />',
      '<script src="view.js"></script>',
      '    <script src="file:///C:/Users/Ana%20Maria/visual-review/web/vendor/elk.bundled.js"></script>',
      '<script src="file:///C:/Users/Ana%20Maria/visual-review/web/app.js"></script>',
    ].join('\n'),
  )
})

test('TC-17 NFR-08 a file URL keeps the drive, encodes spaces and #, and has 3 slashes on Windows and POSIX', () => {
  expect([fileUrl('C:\\Users\\Ana Maria\\#tmp\\review.html'), fileUrl('/tmp/claude-visual-review/s 1/review.html')]).toEqual([
    'file:///C:/Users/Ana%20Maria/%23tmp/review.html',
    'file:///tmp/claude-visual-review/s%201/review.html',
  ])
})

test('FR-24 view.js hands the view model to the static page as window.VIEW', () => {
  expect(staticViewOf('{"version":1}')).toBe('window.VIEW = {"version":1}\n')
})

const PLATFORMS = [
  ['Windows', { os: 'Windows_NT' }, '', 'windows'],
  ['macOS', {}, 'Darwin\n', 'mac'],
  ['Linux', {}, 'Linux\n', 'linux'],
] as const

for (const [name, env, uname, expected] of PLATFORMS) {
  test(`NFR-08 the platform is read as ${name}`, async () => {
    const host = { env: async () => env, run: async () => ({ exitCode: 0, stdout: uname }) } as unknown as Host

    expect(await platformOf(host)).toBe(expected)
  })
}
