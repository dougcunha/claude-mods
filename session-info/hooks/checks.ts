import type { CheckKind, CheckRun, Checks, CheckStatus } from '../types'

import type { Host } from './host'
import { buildErrorCount, buildErrors, clean, failedTests, fullOutputPath, tailLines, testCounts, vitestReport, vitestReportPath } from './parse'
import type { TestCounts } from './parse'
import { duration } from './session'

export const NO_CHECKS: Checks = { build: null, test: null }

export type Patterns = { build?: RegExp; test?: RegExp }

/** A finished shell call, as `tool.call` resolved it; `taskId` names the background task of a command still running. */
export type ShellRun = {
  command: string
  text: string
  isError: boolean
  isAgent: boolean
  taskId?: string
  persistedPath?: string
}

const MAX_ERRORS = 3
const MAX_FAILURES = 5
export const MAX_READ = 1_000_000

// Each segment of a shell command is matched against these, so the lists stay anchored and free of nested repeats.
const TEST = [
  /^dotnet\s+test(?=\s|$)/,
  /^dotnet\s+run\s.*\btests?\b/i,
  /^(?:npm|pnpm|yarn|bun)\s+(?:run(?:-script)?\s+)?test(?::\S+)?(?=\s|$)/,
  /^npm\s+t(?=\s|$)/,
  /^(?:jest|vitest|mocha|ava|cypress\s+run|gotestsum|ctest)(?=\s|$)/,
  /^playwright\s+test(?=\s|$)/,
  /^node\s+(?:\S+\s+)*--test(?=\s|$)/,
  /^deno\s+test(?=\s|$)/,
  /^claude\s+plugin\s+test(?=\s|$)/,
  /^(?:turbo|nx)\s+(?:run\s+)?test(?::\S+)?(?=\s|$)/,
  /^cargo\s+(?:test|nextest)(?=\s|$)/,
  /^go\s+test(?=\s|$)/,
  /^(?:(?:py|python3?)\s+-m\s+)?(?:pytest|unittest)(?=\s|$)/,
  /^(?:tox|nox)(?=\s|$)/,
  /^(?:\.\/)?(?:gradlew?|mvnw?)(?:\.bat|\.cmd)?\s.*\b(?:test|check|verify)\b/,
  /^(?:rspec|rake\s+(?:test|spec)|(?:bin\/)?rails\s+test)(?=\s|$)/,
  /^(?:\S*\/)?(?:phpunit|pest)(?=\s|$)/,
  /^php\s+artisan\s+test(?=\s|$)/,
  /^(?:mix|swift|flutter|dart|stack|cabal)\s+test(?=\s|$)/,
  /^zig\s+(?:build\s+)?test(?=\s|$)/,
  /^make\s+(?:test|check)(?=\s|$)/,
]

const BUILD = [
  /^dotnet\s+(?:build|publish|pack|msbuild)(?=\s|$)/,
  /^msbuild(?:\.exe)?(?=\s|$)/i,
  /^(?:npm|pnpm|yarn|bun)\s+(?:run(?:-script)?\s+)?(?:build|compile|typecheck|type-check)(?::\S+)?(?=\s|$)/,
  /^bun\s+build(?=\s|$)/,
  /^(?:tsc|vue-tsc|tsgo|tsup|esbuild|webpack|rollup)(?=\s|$)/,
  /^(?:vite|next|nuxt|astro|ng|parcel|turbo|nx|flutter)\s+(?:run\s+)?build(?::\S+)?(?=\s|$)/,
  /^claude\s+plugin\s+validate(?=\s|$)/,
  /^cargo\s+(?:build|check|clippy)(?=\s|$)/,
  /^go\s+(?:build|vet)(?=\s|$)/,
  /^(?:\.\/)?(?:gradlew?|mvnw?)(?:\.bat|\.cmd)?\s.*\b(?:build|assemble|package|compile|install)\b/,
  /^(?:swift|zig|stack|cabal)\s+build(?=\s|$)/,
  /^mix\s+compile(?=\s|$)/,
  /^xcodebuild(?=\s|$)/,
  /^(?:cmake\s+--build|ninja)(?=\s|$)/,
  /^make(?:\s+-[\w-]+)*(?:\s+(?:all|build))?\s*$/,
]

const IGNORED = /(?:^|\s)(?:--list-tests|--help|--version)(?=\s|$)/

/** Runners in front of the real tool, with the options they take before it: `npx -y -p typescript tsc` runs `tsc`. */
const PREFIX =
  /^(?:rtk(?:\s+proxy)?|time|env|&|(?:npx|bunx|uvx|(?:pnpm|yarn)\s+(?:exec|dlx))(?:\s+(?:--package(?:=|\s+)\S+|-p\s+\S+|-[\w-]+))*|(?:uv|poetry|pipenv|hatch)\s+run|bundle\s+exec|[A-Za-z_]\w*=\S*)\s+/

/** A segment without the wrappers that run the real tool: `rtk`, `npx`, env assignments. */
function unwrap(segment: string): string {
  let current = segment.trim().replace(/^[({]\s*/, '')
  for (let next = current.replace(PREFIX, ''); next !== current; next = current.replace(PREFIX, '')) current = next

  return current
}

/** A user pattern from the settings; an invalid one is ignored. */
export function toPattern(source: unknown): RegExp | undefined {
  if (typeof source !== 'string' || source.trim() === '') return undefined
  try {
    return new RegExp(source, 'i')
  } catch {
    return undefined
  }
}

/** A shell command's segments, each without its wrappers: `cd app && rtk git push` gives `cd app` and `git push`. */
export const segments = (command: string): string[] => command.split(/\s*(?:&&|\|\||[;|\n])\s*/).map(unwrap)

/** Which checks a command runs, segment by segment: `cd app && npm test` is a test run. */
export function classify(command: string, custom: Patterns = {}): CheckKind[] {
  const kinds = new Set<CheckKind>()
  for (const segment of segments(command)) {
    if (segment === '' || IGNORED.test(segment)) continue
    if (custom.test?.test(segment) || TEST.some(pattern => pattern.test(segment))) kinds.add('test')
    else if (custom.build?.test(segment) || BUILD.some(pattern => pattern.test(segment))) kinds.add('build')
  }

  return [...kinds]
}

/** The first value each count has across the readings, in order. */
const mergeCounts = (...readings: (TestCounts | undefined)[]): TestCounts => ({
  passed: readings.find(r => r?.passed !== undefined)?.passed,
  failed: readings.find(r => r?.failed !== undefined)?.failed,
  skipped: readings.find(r => r?.skipped !== undefined)?.skipped,
  total: readings.find(r => r?.total !== undefined)?.total,
})

async function readClean(host: Host, path: string | undefined): Promise<string | undefined> {
  if (path === undefined) return undefined
  const text = await host.readFile(path).catch(() => undefined)

  return text === undefined ? undefined : clean(text.slice(-MAX_READ))
}

type Base = Pick<CheckRun, 'command' | 'at' | 'isAgent'>

function buildRun(base: Base, text: string, whole: string | undefined, isError: boolean): CheckRun {
  const errors = buildErrors(whole ?? text)
  const found = errors.length > 0 ? errors : buildErrors(text)
  const errorCount = buildErrorCount(text) ?? (whole === undefined ? undefined : buildErrorCount(whole)) ?? (found.length || undefined)
  const isFailed = isError || (errorCount ?? 0) > 0
  const shown = found.length > 0 ? found : tailLines(text, MAX_ERRORS)

  return { ...base, kind: 'build', status: isFailed ? 'failed' : 'passed', errors: isFailed ? shown : [], errorCount, failures: [] }
}

function testRun(base: Base, text: string, whole: string | undefined, report: ReturnType<typeof vitestReport>, isError: boolean): CheckRun {
  const counts = mergeCounts(testCounts(text), whole === undefined ? undefined : testCounts(whole), report?.counts)
  const listed = failedTests(text)
  const failures = listed.length > 0 ? listed : [whole === undefined ? [] : failedTests(whole), report?.failures ?? []].find(names => names.length > 0) ?? []
  const isFailed = isError || (counts.failed ?? 0) > 0 || failures.length > 0
  const isExplained = failures.length > 0 || (counts.failed ?? 0) > 0
  const reason = buildErrors(whole ?? text)
  const errors = isFailed && !isExplained ? (reason.length > 0 ? reason : tailLines(text, MAX_ERRORS)) : []

  return { ...base, kind: 'test', status: isFailed ? 'failed' : 'passed', errors, ...counts, failures }
}

/** One record per check the command ran, read from its output and any whole copy of it on disk. */
export async function checkRuns(host: Host, kinds: readonly CheckKind[], shell: ShellRun, at: number): Promise<CheckRun[]> {
  const base: Base = { command: (shell.command.split('\n')[0] ?? '').trim(), at, isAgent: shell.isAgent }
  if (shell.taskId !== undefined) return kinds.map(kind => ({ ...base, kind, status: 'running', taskId: shell.taskId, errors: [], failures: [] }))

  const text = clean(shell.text)
  const whole = await readClean(host, shell.persistedPath ?? fullOutputPath(text, (await host.env()).home))
  const reportPath = kinds.includes('test') ? vitestReportPath(text) : undefined
  const report = reportPath === undefined ? undefined : vitestReport((await host.readFile(reportPath).catch(() => undefined)) ?? '')

  return kinds.map(kind => (kind === 'build' ? buildRun(base, text, whole, shell.isError) : testRun(base, text, whole, report, shell.isError)))
}

export const CHECK_STATUS = {
  passed: { glyph: '✓', color: 'success' },
  failed: { glyph: '✖', color: 'error' },
  running: { glyph: '⟳', color: 'suggestion' },
} as const satisfies Record<CheckStatus, { glyph: string; color: string }>

/** One check as the pane draws it: a head row, then the error lines or failed test names. */
export type CheckView = { run: CheckRun; label: string; result: string; details: string[] }

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

function resultText(run: CheckRun): string {
  if (run.status === 'running') return 'running in background'
  if (run.kind === 'build') return run.status === 'failed' && run.errorCount ? plural(run.errorCount, 'error') : run.status
  if (run.status === 'passed') return run.passed === undefined ? 'passed' : `${run.passed} passed${run.skipped ? ` · ${run.skipped} skipped` : ''}`
  if (run.failed === undefined) return 'failed'
  const total = run.total ?? (run.passed === undefined ? undefined : run.failed + run.passed + (run.skipped ?? 0))

  return total === undefined ? `${run.failed} failed` : `${run.failed} failed / ${total}`
}

function detailLines(run: CheckRun): string[] {
  const items = run.failures.length > 0 ? run.failures : run.errors
  const room = run.failures.length > 0 ? MAX_FAILURES : MAX_ERRORS
  const shown = items.slice(0, room)

  return items.length > room ? [...shown, `… ${items.length - room} more`] : shown
}

export function checkViews(checks: Checks): CheckView[] {
  return [checks.build, checks.test]
    .filter((run): run is CheckRun => run !== null)
    .map(run => ({ run, label: run.kind === 'build' ? 'Build' : 'Tests', result: resultText(run), details: detailLines(run) }))
}

/** The head row's right side: `agent · 2m 5s ago`. */
export const checkWhen = (run: CheckRun, now: number): string =>
  `${run.isAgent ? 'agent · ' : ''}${duration(now - run.at)} ago`

/** The section header's right side: `✓ build  ✖ tests`. */
export function checkSummary(checks: Checks): string {
  return checkViews(checks).map(({ run }) => `${CHECK_STATUS[run.status].glyph} ${run.kind === 'build' ? 'build' : 'tests'}`).join('  ')
}

/** Failed test names the fix prompt lists before the rest fold into `and N more`. */
const FIX_ROOM = 3

function testFix(run: CheckRun): string {
  const count = run.failed ?? run.failures.length
  if (count === 0) return 'Fix the failed test run'
  const names = run.failures.slice(0, FIX_ROOM).join(', ')
  const more = run.failures.length > FIX_ROOM ? ` and ${run.failures.length - FIX_ROOM} more` : ''

  return `Fix the ${plural(count, 'failed test')}${names === '' ? '' : `: ${names}${more}`}`
}

/** The prompt that asks for a fix of the failed build, else of the failed tests, which a failed build often explains; the key names the run. */
export function fixSuggestion(checks: Checks): { key: string; text: string } | undefined {
  const run = [checks.build, checks.test].find(one => one?.status === 'failed')
  if (!run) return undefined
  const text = run.kind === 'test' ? testFix(run) : run.errorCount ? `Fix the ${plural(run.errorCount, 'build error')}` : 'Fix the failed build'

  return { key: `${run.kind}@${run.at}`, text }
}

export const checkRowCount = (views: readonly CheckView[]): number =>
  views.reduce((rows, view) => rows + 2 + view.details.length, 0)
