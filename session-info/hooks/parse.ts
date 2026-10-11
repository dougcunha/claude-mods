/**
 * Reads build and test output as the model got it: raw, filtered by RTK, or localized.
 * Localized .NET output is read by its structure (field order, `error CS`, `[FAIL]`), not its words.
 */

export type TestCounts = { passed?: number; failed?: number; skipped?: number; total?: number }

const MAX_NAMES = 50

const num = (value: string | undefined): number | undefined => (value === undefined ? undefined : Number(value))

const basename = (path: string): string => path.split(/[\\/]/).pop() ?? path

const first = (match: RegExpExecArray): string => match[1] ?? ''

const unique = (items: readonly string[]): string[] => [...new Set(items.map(item => item.trim()).filter(Boolean))]

/** No colors, `\n` line ends, and no `Exit code N` header. */
export function clean(text: string): string {
  return text
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/^(?:Error: )?Exit code -?\d+\n/, '')
}

function matches(text: string, pattern: RegExp): RegExpExecArray[] {
  return [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))]
}

const LOCATED = [
  /^\s*(.+?)\((\d+),(\d+)(?:,\d+,\d+)?\): (?:\w+ )?error ([A-Z]+\d+): (.+?)(?: \[[^\]\n]+\])?$/m,
  /^\s*(.+?):(\d+):(\d+) - error (TS\d+): (.+)$/m,
]

const UNLOCATED = /^\s*(?:\S[^\n:]*: )?error ([A-Z]+\d+): (.+?)(?: \[[^\]\n]+\])?$/m

const GENERIC = /^\s*(?:✘ \[ERROR\] |ERROR in |error(?:\[\w+\])?: )(.+)$/m

/** The error lines of a build, deduplicated; MSBuild repeats each in its summary. */
export function buildErrors(text: string): string[] {
  const located = LOCATED.flatMap(pattern =>
    matches(text, pattern).map(([, file, line, column, code, message]) => `${basename(file ?? '')}(${line},${column}): ${code}: ${message}`))
  if (located.length > 0) return unique(located)
  const coded = matches(text, UNLOCATED).map(([, code, message]) => `${code}: ${message}`)
  if (coded.length > 0) return unique(coded)

  return unique(matches(text, GENERIC).map(first).filter(message => !/exited with code \d+/.test(message)))
}

/** The error count a build reports: MSBuild's `N Error(s)` (any language), RTK's summaries, or tsc's `Found N errors`. */
export function buildErrorCount(text: string): number | undefined {
  const msbuild = matches(text, /^\s*\d+ \S+\(s\)\s*\n\s*(\d+) \S+\(s\)\s*$/m).pop()
  if (msbuild) return num(msbuild[1])
  const summary = /(?:ok dotnet build: \d+ projects?, |TypeScript: |Found )(\d+) errors?/.exec(text)
  if (summary) return num(summary[1])

  return undefined
}

const sum = (rows: RegExpExecArray[], group: number): number => rows.reduce((total, row) => total + Number(row[group]), 0)

type CountRule = (text: string) => TestCounts | undefined

const COUNT_RULES: CountRule[] = [
  text => {
    const rtk = /(?:ok|fail) dotnet test: (\d+) passed, (\d+) failed(?:, (\d+) skipped)?/.exec(text)
    if (rtk) return { passed: num(rtk[1]), failed: num(rtk[2]), skipped: num(rtk[3]) }
    const passed = /ok dotnet test: (\d+) tests? passed/.exec(text)

    return passed ? { passed: num(passed[1]), failed: 0 } : undefined
  },
  text => {
    const rows = matches(text, /^.*!\s+[-–]\s+[^:\n]+:\s*(\d+),\s*[^:\n]+:\s*(\d+),\s*[^:\n]+:\s*(\d+),\s*[^:\n]+:\s*(\d+)/m)

    return rows.length > 0 ? { failed: sum(rows, 1), passed: sum(rows, 2), skipped: sum(rows, 3), total: sum(rows, 4) } : undefined
  },
  text => {
    const block = matches(text, /^.*!\s*\n\s+[^:\n]+:\s*(\d+)\s*\n\s+[^:\n]+:\s*(\d+)\s*\n\s+[^:\n]+:\s*(\d+)\s*\n\s+[^:\n]+:\s*(\d+)\s*$/m).pop()

    return block ? { total: num(block[1]), failed: num(block[2]), passed: num(block[3]), skipped: num(block[4]) } : undefined
  },
  text => {
    const line = matches(text, /^\s*Tests:?\s+(.*\d+ (?:failed|passed).*)$/m).pop()?.[1]
    if (line === undefined) return undefined
    const of = (pattern: RegExp) => num(pattern.exec(line)?.[1])

    return { failed: of(/(\d+) failed/) ?? 0, passed: of(/(\d+) passed/), skipped: of(/(\d+) (?:skipped|todo|pending)/), total: of(/(\d+) total/) ?? of(/\((\d+)\)/) }
  },
  text => {
    const rtk = /^PASS \((\d+)\) FAIL \((\d+)\)/m.exec(text)

    return rtk ? { passed: num(rtk[1]), failed: num(rtk[2]) } : undefined
  },
  text => {
    const fail = /^\s*(\d+) fail\s*$/m.exec(text)
    const pass = /^\s*(\d+) pass\s*$/m.exec(text)
    if (!fail && !pass) return undefined

    return { passed: num(pass?.[1]), failed: num(fail?.[1]) ?? 0, skipped: num(/^\s*(\d+) skip\s*$/m.exec(text)?.[1]), total: num(/Ran (\d+) tests?/.exec(text)?.[1]) }
  },
  text => {
    const of = (label: string) => num(new RegExp(`^[ℹ#] ${label} (\\d+)\\s*$`, 'm').exec(text)?.[1])
    const failed = of('fail')

    return failed === undefined ? undefined : { failed, passed: of('pass'), skipped: of('skipped'), total: of('tests') }
  },
  text => {
    const line = /^=+ (.*\d+ (?:passed|failed).*) in [\d.]+s.* =+$/m.exec(text)?.[1]
    if (line === undefined) return undefined
    const of = (pattern: RegExp) => num(pattern.exec(line)?.[1])

    return { failed: (of(/(\d+) failed/) ?? 0) + (of(/(\d+) errors?/) ?? 0), passed: of(/(\d+) passed/), skipped: of(/(\d+) skipped/) }
  },
  text => {
    const rows = matches(text, /test result: \w+\. (\d+) passed; (\d+) failed; (\d+) ignored/)

    return rows.length > 0 ? { passed: sum(rows, 1), failed: sum(rows, 2), skipped: sum(rows, 3) } : undefined
  },
  text => {
    const failing = /^\s*(\d+) failing\s*$/m.exec(text)
    const passing = /^\s*(\d+) passing\b/m.exec(text)
    if (!failing && !passing) return undefined

    return { passed: num(passing?.[1]), failed: num(failing?.[1]) ?? 0, skipped: num(/^\s*(\d+) pending\s*$/m.exec(text)?.[1]) }
  },
  text => {
    const failed = matches(text, /^--- FAIL: /m).length
    const passed = matches(text, /^--- PASS: /m).length

    return failed + passed > 0 ? { failed, passed: passed || undefined } : undefined
  },
]

/** The counts of the first test summary the output carries. */
export function testCounts(text: string): TestCounts {
  for (const rule of COUNT_RULES) {
    const counts = rule(text)
    if (counts) return counts
  }

  return {}
}

/** The text after `marker`, or nothing when the marker is absent. */
function after(text: string, marker: RegExp): string {
  const start = marker.exec(text)

  return start ? text.slice(start.index + start[0].length) : ''
}

type NameRule = (text: string) => string[]

const NAME_RULES: NameRule[] = [
  text => matches(text, /^\[xUnit\.net [^\]\n]*\]\s+(.+?) \[FAIL\]\s*$/m).map(first),
  text => matches(after(text, /^Failed Tests:\s*$/m), /^ {2}(\S.*)$/m).map(first),
  text => matches(text, /^ {2}\S.*? (\S+) \[[^\]\n]*\]\s*\n {2}\S[^\n]*:\s*$/m).map(first),
  text => matches(text, /^\S.*? ([^\s\\/]+) \((?:\d+[hms] )*\d+m?s\)\s*\n(?= {2}\S)/m).map(first),
  text => matches(text, /^\s*● (.+?)\s*$/m).map(first).filter(name => name !== 'Console'),
  text => (/^PASS \(\d+\) FAIL \(\d+\)/m.test(text) ? matches(text, /^\d+\. (.+)$/m).map(first) : []),
  text => matches(text, /^\s*FAIL\s+\S+ > (.+?)\s*$/m).map(first),
  text => matches(text, /^\s*\(fail\) (.+?)(?: \[[\d.]+m?s\])?\s*$/m).map(first),
  text => matches(after(text, /failing tests:/), /^✖ (.+?) \([\d.]+ms\)\s*$/m).map(first),
  text => matches(text, /^not ok \d+ - (.+)$/m).map(first),
  text => matches(text, /^FAILED (\S+)/m).map(first),
  text => matches(text, /^\s*--- FAIL: (\S+)/m).map(first),
  text => matches(text, /^---- (\S+) stdout ----$/m).map(first),
]

/** The names of the failed tests, from the first runner format that lists any. */
export function failedTests(text: string): string[] {
  for (const rule of NAME_RULES) {
    const names = unique(rule(text))
    if (names.length > 0) return names.slice(0, MAX_NAMES)
  }

  return []
}

/** The last lines worth showing when nothing else in a failed output is recognized. */
export function tailLines(text: string, count: number): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !/^\[full output:/.test(line) && !/^\[RTK:/.test(line))
    .slice(-count)
}

/** Where RTK or Claude Code kept the whole output, when the text is a cut of it. */
export function fullOutputPath(text: string, home: string | undefined): string | undefined {
  const path = /\[full output: "?([^"\]\n]+)"?\]/.exec(text)?.[1]
  if (path === undefined) return undefined
  const isHomeRelative = /^(\$HOME|~)(?=[\\/])/.test(path)
  if (!isHomeRelative) return path

  return home === undefined ? undefined : path.replace(/^(\$HOME|~)/, () => home)
}

/** The vitest JSON report RTK writes in place of vitest's own output. */
export const vitestReportPath = (text: string): string | undefined => /JSON report written to (.+?\.json)\s*$/m.exec(text)?.[1]

type VitestReport = {
  numTotalTests?: number
  numPassedTests?: number
  numFailedTests?: number
  numPendingTests?: number
  testResults?: { assertionResults?: { status?: string; title?: string; ancestorTitles?: string[] }[] }[]
}

/** Counts and failed names from a vitest JSON report. */
export function vitestReport(json: string): { counts: TestCounts; failures: string[] } | undefined {
  try {
    const report = JSON.parse(json) as VitestReport
    const failures = (report.testResults ?? [])
      .flatMap(file => file.assertionResults ?? [])
      .filter(test => test.status === 'failed')
      .map(test => [...(test.ancestorTitles ?? []), test.title ?? ''].join(' > '))
    const counts = { total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests }

    return { counts, failures: unique(failures).slice(0, MAX_NAMES) }
  } catch {
    return undefined
  }
}
