import { expect, test } from 'claude-code/testing'

import { checkRuns, checkViews, classify, toPattern } from '../hooks/checks'
import type { ShellRun } from '../hooks/checks'
import type { Host } from '../hooks/host'
import { buildErrorCount, buildErrors, clean, failedTests, fullOutputPath, testCounts, vitestReport } from '../hooks/parse'
import type { CheckRun } from '../types'

const PANE = {
  plugin: 'session-info',
  component: 'Pane',
  requestId: 'session-info',
  props: { title: 'Session info', isFocused: true, bodyColumns: 100 },
} as const

const usage = { value: { startedAt: 0, context: {}, rateLimits: [] } } as never

const BUILD_RTK_FAILED = `Exit code 1
C:\\p\\dn-build\\Class1.cs(7,20): error CS0029: Cannot implicitly convert type 'int' to 'string' [C:\\p\\dn-build\\dn-build.csproj]
C:\\p\\dn-build\\Class1.cs(8,16): error CS0103: The name 'undefinedVar' does not exist in the current context [C:\\p\\dn-build\\dn-build.csproj]

Build FAILED.

C:\\p\\dn-build\\Class1.cs(7,20): error CS0029: Cannot implicitly convert type 'int' to 'string' [C:\\p\\dn-build\\dn-build.csproj]
C:\\p\\dn-build\\Class1.cs(8,16): error CS0103: The name 'undefinedVar' does not exist in the current context [C:\\p\\dn-build\\dn-build.csproj]
    0 Warning(s)
    2 Error(s)

BinaryLogger wrote to: C:\\Temp\\rtk_dotnet_build_1a12.binlog

Time Elapsed 00:00:01.47`

const BUILD_RAW_PT = `Exit code 1\r
C:\\p\\dn-build\\Class1.cs(7,20): error CS0029: Não é possível converter implicitamente tipo "int" em "string" [C:\\p\\dn-build\\dn-build.csproj]\r
\r
FALHA da compilação.\r
\r
C:\\p\\dn-build\\Class1.cs(7,20): error CS0029: Não é possível converter implicitamente tipo "int" em "string" [C:\\p\\dn-build\\dn-build.csproj]\r
    0 Aviso(s)\r
    1 Erro(s)\r
\r
Tempo Decorrido 00:00:00.67`

const VSTEST_RAW_PT = `Exit code 1
[xUnit.net 00:00:01.19]     dn_vstest.CalculatorTests.Subtract_Fails [FAIL]
[xUnit.net 00:00:01.22]     dn_vstest.CalculatorTests.Divide_Throws [FAIL]
  Com falha dn_vstest.CalculatorTests.Subtract_Fails [270 ms]
  Mensagem de erro:
   Assert.Equal() Failure: Values differ
  Com falha dn_vstest.CalculatorTests.Divide_Throws [< 1 ms]
  Mensagem de erro:
   System.InvalidOperationException : boom

Com falha! – Com falha:     2, Aprovado:     1, Ignorado:     0, Total:     3, Duração: 326 ms - dn-vstest.dll (net10.0)`

const VSTEST_RTK = `Exit code 1
Failed Tests:
  dn_vstest.CalculatorTests.Subtract_Fails
    Error Message:
    Assert.Equal() Failure: Values differ
    Stack Trace:
    at dn_vstest.CalculatorTests.Subtract_Fails() in C:\\p\\UnitTest1.cs:line 9

  dn_vstest.CalculatorTests.Divide_Throws
    Error Message:
    System.InvalidOperationException : boom
    Results File: C:\\Temp\\rtk_dotnet_testresults\\run.trx



fail dotnet test: 1 passed, 2 failed, 0 skipped, 0 warnings in 1 projects (1.2 s)`

const MTP_RAW_PT = `Exit code 2
Executando testes de C:\\p\\dn-mtp\\bin\\Debug\\net10.0\\dn-mtp.dll (net10.0|x64)
com falha Subtract_Fails (42ms)
  Assert.AreEqual falhou. Esperado:<5>. Real:<2>.
    em dn_mtp.CalculatorTests.Subtract_Fails() em C:\\p\\Test1.cs:10
com falha Divide_Throws (42ms)
  O método de teste dn_mtp.CalculatorTests.Divide_Throws lançou a exceção:
C:\\p\\dn-mtp\\bin\\Debug\\net10.0\\dn-mtp.dll (net10.0|x64) falhou com 2 erros (762ms)
Código de saída: 2

Resumo da execução de teste: Falhou!
  total: 3
  falhou: 2
  concluído com êxito: 1
  ignorados: 0
  duração: 1s 521ms
Execução de testes concluída com código de saída sem sucesso: 2`

const MTP_RTK_EN = `Exit code 2
failed Subtract_Fails (17ms)
  Assert.AreEqual failed. Expected:<5>. Actual:<2>.
failed Divide_Throws (1s 17ms)
  Test method dn_mtp.CalculatorTests.Divide_Throws threw exception:
Exit code: 2

Test run summary: Failed!
  total: 3
  failed: 2
  succeeded: 1
  skipped: 0
  duration: 1s 102ms`

const VITEST = `Exit code 1

> test
> vitest run

 ❯ vitest-tests/calc.test.ts (3 tests | 2 failed) 13ms
     × subtracts 8ms

 FAIL  vitest-tests/calc.test.ts > calculator > subtracts
AssertionError: expected 2 to be 5 // Object.is equality

 FAIL  vitest-tests/calc.test.ts > calculator > divides
Error: boom

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
   Duration  891ms`

const JEST_RTK = `Exit code 1
PASS (1) FAIL (2)

1. calculator subtracts
   Error: expect(received).toBe(expected) // Object.is equality
2. calculator divides
   Error: boom
[full output: "$HOME/AppData/Local/rtk/tee/1791725738_jest_run.log"]`

const BUN_RTK = `Exit code 1
[FAIL] FAILURES:
  (fail) calculator > subtracts [0.34ms]
  (fail) calculator > divides [0.35ms]
  error: boom

SUMMARY:
   1 pass
   2 fail
  Ran 3 tests across 1 file. [26.00ms]`

const NODE_TEST = `Exit code 1
▶ calculator
  ✔ adds (0.8487ms)
  ✖ subtracts (1.4985ms)
✖ calculator (5.8724ms)
ℹ tests 3
ℹ suites 1
ℹ pass 1
ℹ fail 2

✖ failing tests:

test at node-tests\\calc.test.mjs:5:3
✖ subtracts (1.4985ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

test at node-tests\\calc.test.mjs:6:3
✖ divides (0.2594ms)
  Error: boom`

const CARGO_RTK = `Exit code 101
---- tests::subtracts stdout ----

thread 'tests::subtracts' (17940) panicked at src\\lib.rs:9:22:
assertion failed: left == right


test result: FAILED. 1 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
[full output: "$HOME/AppData/Local/rtk/tee/1791727108_cargo_test.log"]`

const TSC_RTK = `Exit code 1
src/index.ts(2,9): error TS2322: Type 'number' is not assignable to type 'string'.
src/index.ts(3,10): error TS2304: Cannot find name 'missing'.
TypeScript: 2 errors in 1 files
Top codes: TS2304 (1x), TS2322 (1x)`

const BUN_BUILD = `Exit code 1
$ bun build src/index.ts --outdir dist
2 |   return a + ;
                 ^
error: Unexpected ;
    at C:\\p\\bun\\src\\index.ts:2:14
error: script "build" exited with code 1`

const host = (files: Record<string, string> = {}): Host =>
  ({
    readFile: async (path: string) => {
      if (path in files) return files[path]
      throw new Error(`no ${path}`)
    },
    env: async () => ({ home: 'C:/Users/me' }),
  }) as unknown as Host

const one = async (...args: Parameters<typeof checkRuns>): Promise<CheckRun> => {
  const [run] = await checkRuns(...args)
  if (run === undefined) throw new Error('no check run')

  return run
}

const shell = (text: string, more: Partial<ShellRun> = {}): ShellRun =>
  ({ command: 'dotnet test', text, isError: text.startsWith('Exit code'), isBackground: false, isAgent: false, ...more })

test('classifies build and test commands through wrappers and compound commands', async () => {
  expect(classify('dotnet build dn-build --no-restore')).toEqual(['build'])
  expect(classify('rtk dotnet test --project tests/App.Tests --no-build -- --minimum-expected-tests 1')).toEqual(['test'])
  expect(classify('rtk dotnet run --project tests/TokenHound.Tests --no-build')).toEqual(['test'])
  expect(classify('cd node && npm test')).toEqual(['test'])
  expect(classify('npx vitest run')).toEqual(['test'])
  expect(classify('bun test')).toEqual(['test'])
  expect(classify('bun run build')).toEqual(['build'])
  expect(classify('CI=1 npx tsc -p .')).toEqual(['build'])
  expect(classify('dotnet build && dotnet test --no-build')).toEqual(['build', 'test'])
  expect(classify('dotnet test x | tail -3')).toEqual(['test'])
  expect(classify('& dotnet build App.sln')).toEqual(['build'])
  expect(classify('dotnet test --list-tests')).toEqual([])
  expect(classify('dotnet build-server shutdown')).toEqual([])
  expect(classify('dotnet run --project src/App -- --target latest')).toEqual([])
  expect(classify('git status')).toEqual([])
  expect(classify('make test', { test: toPattern('^make test') })).toEqual(['test'])
  expect(toPattern('(')).toBeUndefined()
})

test('reads build errors and counts from RTK, localized MSBuild, tsc and bun', async () => {
  expect(buildErrors(clean(BUILD_RTK_FAILED))).toEqual([
    "Class1.cs(7,20): CS0029: Cannot implicitly convert type 'int' to 'string'",
    "Class1.cs(8,16): CS0103: The name 'undefinedVar' does not exist in the current context",
  ])
  expect(buildErrorCount(clean(BUILD_RTK_FAILED))).toBe(2)
  expect(buildErrors(clean(BUILD_RAW_PT))).toEqual(['Class1.cs(7,20): CS0029: Não é possível converter implicitamente tipo "int" em "string"'])
  expect(buildErrorCount(clean(BUILD_RAW_PT))).toBe(1)
  expect(buildErrorCount('ok dotnet build: 1 projects, 0 errors, 0 warnings (00:00:00.94)')).toBe(0)
  expect(buildErrorCount(clean(TSC_RTK))).toBe(2)
  expect(buildErrors(clean(TSC_RTK))[1]).toBe("index.ts(3,10): TS2304: Cannot find name 'missing'.")
  expect(buildErrors(clean(BUN_BUILD))).toEqual(['Unexpected ;'])
})

test('reads test counts and failed names from each runner format', async () => {
  const cases: [string, Record<string, number | undefined>, string[]][] = [
    [VSTEST_RAW_PT, { failed: 2, passed: 1, skipped: 0, total: 3 }, ['dn_vstest.CalculatorTests.Subtract_Fails', 'dn_vstest.CalculatorTests.Divide_Throws']],
    [VSTEST_RTK, { passed: 1, failed: 2, skipped: 0, total: undefined }, ['dn_vstest.CalculatorTests.Subtract_Fails', 'dn_vstest.CalculatorTests.Divide_Throws']],
    [MTP_RAW_PT, { total: 3, failed: 2, passed: 1, skipped: 0 }, ['Subtract_Fails', 'Divide_Throws']],
    [MTP_RTK_EN, { total: 3, failed: 2, passed: 1, skipped: 0 }, ['Subtract_Fails', 'Divide_Throws']],
    [VITEST, { failed: 2, passed: 1, skipped: undefined, total: 3 }, ['calculator > subtracts', 'calculator > divides']],
    [JEST_RTK, { passed: 1, failed: 2 }, ['calculator subtracts', 'calculator divides']],
    [BUN_RTK, { passed: 1, failed: 2, skipped: undefined, total: 3 }, ['calculator > subtracts', 'calculator > divides']],
    [CARGO_RTK, { passed: 1, failed: 1, skipped: 0 }, ['tests::subtracts']],
    [NODE_TEST, { failed: 2, passed: 1, skipped: undefined, total: 3 }, ['subtracts', 'divides']],
  ]
  for (const [output, counts, names] of cases) {
    expect(testCounts(clean(output))).toEqual(counts)
    expect(failedTests(clean(output))).toEqual(names)
  }
  expect(testCounts('ok dotnet test: 1 tests passed, 0 warnings in 1 projects (807 ms)')).toEqual({ passed: 1, failed: 0 })
  expect(testCounts('ok dotnet test: completed (binlog-only mode, counts unavailable, 0 warnings) (unknown)')).toEqual({})
})

test('resolves RTK full-output paths and reads vitest JSON reports', async () => {
  expect(fullOutputPath(JEST_RTK, 'C:/Users/me')).toBe('C:/Users/me/AppData/Local/rtk/tee/1791725738_jest_run.log')
  expect(fullOutputPath(JEST_RTK, undefined)).toBeUndefined()
  const report = vitestReport(JSON.stringify({
    numTotalTests: 3, numPassedTests: 1, numFailedTests: 2, numPendingTests: 0,
    testResults: [{ assertionResults: [
      { status: 'passed', title: 'adds', ancestorTitles: ['calculator'] },
      { status: 'failed', title: 'subtracts', ancestorTitles: ['calculator'] },
    ] }],
  }))
  expect(report?.counts).toEqual({ total: 3, passed: 1, failed: 2, skipped: 0 })
  expect(report?.failures).toEqual(['calculator > subtracts'])
})

test('a piped run that hid the exit code still fails on its summary', async () => {
  const piped = VSTEST_RAW_PT.replace('Exit code 1\n', '')
  const run = await one(host(), ['test'], shell(piped, { command: 'dotnet test x | tail -3' }), 0)
  expect(run.status).toBe('failed')
  expect(run.failed).toBe(2)
})

test('a build that failed with nothing recognizable shows the last lines', async () => {
  const run = await one(host(), ['build'], shell('Exit code 1\nsomething broke\nfor a reason', { command: 'npm run build' }), 0)
  expect(run).toMatchObject({ status: 'failed', errors: ['something broke', 'for a reason'] })
})

test('a test run that failed to compile shows the compile errors', async () => {
  const run = await one(host(), ['test'], shell(BUILD_RTK_FAILED), 0)
  expect(run.status).toBe('failed')
  expect(run.errors.length).toBe(2)
})

test('the RTK vitest report and tee log fill in what the text lacks', async () => {
  const report = JSON.stringify({ numTotalTests: 2, numPassedTests: 1, numFailedTests: 1, testResults: [{ assertionResults: [{ status: 'failed', title: 'divides', ancestorTitles: ['calculator'] }] }] })
  const text = 'Exit code 1\n[RTK:PASSTHROUGH] vitest parser: All parsing tiers failed\nJSON report written to C:/p/.vitest/json/output.json'
  const vitest = await one(host({ 'C:/p/.vitest/json/output.json': report }), ['test'], shell(text, { command: 'npx vitest run' }), 0)
  expect(vitest).toMatchObject({ status: 'failed', failed: 1, total: 2, failures: ['calculator > divides'] })

  const cut = 'Exit code 1\n[full output: "$HOME/rtk/tee/jest.log"]'
  const jest = await one(host({ 'C:/Users/me/rtk/tee/jest.log': JEST_RTK }), ['test'], shell(cut, { command: 'npx jest' }), 0)
  expect(jest).toMatchObject({ status: 'failed', failed: 2, failures: ['calculator subtracts', 'calculator divides'] })
})

test('a background run shows as running; views summarize each check', async () => {
  const running = await one(host(), ['test'], shell('', { isBackground: true }), 0)
  expect(running.status).toBe('running')

  const build = await one(host(), ['build'], shell(BUILD_RTK_FAILED, { command: 'dotnet build' }), 0)
  const tests = await one(host(), ['test'], shell(MTP_RAW_PT), 0)
  const views = checkViews({ build, test: tests })
  expect(views.map(view => view.result)).toEqual(['2 errors', '2 failed / 3'])
  expect(views[1]?.details).toEqual(['Subtract_Fails', 'Divide_Throws'])

  const passed = await one(host(), ['test'], shell('ok dotnet test: 12 tests passed, 0 warnings in 1 projects (807 ms)'), 0)
  expect(checkViews({ build: null, test: passed })[0]?.result).toBe('12 passed')
})

test('the checks section shows the last build and test run of any agent', async ($, on) => {
  on('session.cwd', async () => ({ value: '/repo' }))
  on('agent.list', async () => ({ value: [] }))
  on('session.usage', async () => usage)
  on('env.get', async () => ({ value: undefined }))
  on('process.run', async () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('tool.call', { tool: 'Bash' }, async (_, e) =>
    (e.command.startsWith('dotnet build')
      ? { isError: true, result: `Error: ${BUILD_RTK_FAILED}`, text: BUILD_RTK_FAILED }
      : { result: { stdout: 'ok dotnet test: 12 tests passed, 0 warnings in 1 projects (807 ms)', stderr: '', interrupted: false }, text: 'ok dotnet test: 12 tests passed, 0 warnings in 1 projects (807 ms)' }) as never)

  const empty = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await empty.find({ type: 'Text', text: /No build or test run/ })).toBeDefined()
  await empty.unmount()

  await $.tool.call({ tool: 'Bash', command: 'dotnet build App.sln' })
  await $.tool.call({ tool: 'Bash', command: 'rtk dotnet test --project tests/App.Tests' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '✖ build  ✓ tests' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  2 errors' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /CS0103/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  12 passed' })).toBeDefined()

  await ui.press({ key: 'section:#checks' })
  expect(await ui.find({ type: 'Text', text: '  12 passed' })).toBeUndefined()
  await ui.unmount()
})
