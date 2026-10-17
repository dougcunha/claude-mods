import type { CheckKind, Checks, Guard, GuardRun, GuardSkip } from '../types'

import { checkViews } from './checks'
import type { Host } from './host'
import { hash, norm } from './paths'
import { duration } from './session'

/** The `$.store` key of the build guard switch; the store outlives the session, so the switch stays as the person left it. */
export const GUARD_STORE = 'buildGuardOn'

export const NO_GUARD: Guard = { runs: {}, skips: [], count: 0, savedMs: 0, savedChars: 0 }

/** A passed run stops being reused after this long: a test can depend on a database or a service that changed meanwhile. */
export const GUARD_TTL_MS = 30 * 60_000
/** Past this many untracked files the tree is not fingerprinted (their names would not fit one command line), and nothing is skipped. */
const MAX_UNTRACKED = 200
/** Passed runs kept at most; the oldest go first. */
const MAX_RUNS = 50
/** Skips the section lists. */
export const SKIP_ROOM = 3

/** A comment the model appends to run an unchanged build anyway; `#` starts a comment in bash and in PowerShell alike. */
const BYPASS = /\s*#\s*rerun\b.*$/m

export const isBypassed = (command: string): boolean => BYPASS.test(command)

/**
 * The command as the guard compares it: spaces collapsed, the `rerun` comment and the `rtk` wrapper removed, so a run
 * the RTK hook rewrote and one it did not share a fingerprint. Env assignments stay: `PORT=1 npm test` is another run.
 */
export const commandKey = (command: string): string =>
  command
    .replace(BYPASS, '')
    .replace(/(^|&&|\|\||;)\s*rtk(?:\s+proxy)?\s+/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()

/** FNV-1a is 32 bits: a second pass from another offset basis makes a chance collision between two trees negligible. */
const SECOND_BASIS = 0x01000193

function fnv(text: string, basis: number): string {
  let h = basis
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }

  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * A fingerprint of the command and of the working tree it runs on: the folder, HEAD, the diff of every tracked change
 * (tracked changes inside submodules included) and the content of every untracked file that .gitignore does not hide.
 * Build output lives in ignored folders, so a build leaves the fingerprint as it was. Undefined outside a repository,
 * on a repository without commits, or when git fails: the command then runs.
 */
export async function treeKey(host: Host, cwd: string, command: string): Promise<string | undefined> {
  // A cut output would make two different trees that share its head look alike, and skip a build that must run.
  const git = async (argv: string[], dir: string) => {
    const out = await host.run(['git', ...argv], dir)

    return out.exitCode === 0 && out.isStdoutTruncated !== true ? out.stdout : undefined
  }
  const top = await git(['rev-parse', '--show-toplevel'], cwd)
  if (top === undefined) return undefined
  const root = norm(top.trim())
  const head = await git(['rev-parse', 'HEAD'], root)
  const diff = head === undefined ? undefined : await git(['diff', 'HEAD', '--no-ext-diff', '--no-color', '--binary', '--submodule=diff'], root)
  const others = diff === undefined ? undefined : await git(['ls-files', '--others', '--exclude-standard', '-z'], root)
  if (head === undefined || diff === undefined || others === undefined) return undefined
  const names = others.split('\0').filter(name => name !== '').sort()
  if (names.length > MAX_UNTRACKED) return undefined
  const objects = names.length === 0 ? '' : await git(['hash-object', '--', ...names], root)
  if (objects === undefined) return undefined

  const text = [norm(cwd), commandKey(command), head.trim(), diff, names.join('\n'), objects].join('\0')

  return `${hash(text)}${fnv(text, SECOND_BASIS)}`
}

/** The passed run a command on this tree can reuse: the same fingerprint, younger than the TTL. */
export function reusable(guard: Guard, key: string, now: number): GuardRun | undefined {
  const run = guard.runs[key]

  return run !== undefined && now - run.at < GUARD_TTL_MS ? run : undefined
}

const label = (kinds: readonly CheckKind[]): string => (kinds.includes('build') && kinds.includes('test') ? 'build and tests' : kinds.includes('test') ? 'test run' : 'build')

/** What the model reads in place of the output: which run is reused, its result, and how to run the command anyway. */
export function guardReply(run: GuardRun, now: number): string {
  return [
    `session-info build guard: the ${label(run.kinds)} did not run again. Nothing in the working tree changed since the same command passed ${duration(now - run.at)} ago.`,
    ...run.results,
    'Change the code before you run it again. To run it anyway, append `# rerun` to the command.',
  ].join('\n')
}

/** The result lines of the checks that ran since `since`, when every one of `kinds` passed; else undefined. */
export function passedResults(checks: Checks, kinds: readonly CheckKind[], since: number): string[] | undefined {
  const views = checkViews(checks).filter(view => kinds.includes(view.run.kind) && view.run.at >= since)
  if (views.length !== kinds.length || views.some(view => view.run.status !== 'passed')) return undefined

  return views.map(view => `${view.label}: ${view.result}`)
}

/** The guard with the passed run kept under its fingerprint, without runs past the TTL, at most MAX_RUNS of them. */
export function withRun(guard: Guard, key: string, run: GuardRun): Guard {
  const kept = Object.entries({ ...guard.runs, [key]: run })
    .filter(([, one]) => run.at - one.at < GUARD_TTL_MS)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, MAX_RUNS)

  return { ...guard, runs: Object.fromEntries(kept) }
}

/** A run that did not pass forgets the fingerprint, so a flaky test that failed on `# rerun` is not reused as passed. */
export function withoutRun(guard: Guard, key: string): Guard {
  if (guard.runs[key] === undefined) return guard
  const { [key]: _, ...runs } = guard.runs

  return { ...guard, runs }
}

/** The guard after a skip: the newest skip first, and the time and output the skipped run would have taken. */
export function withSkip(guard: Guard, run: GuardRun, skip: GuardSkip): Guard {
  return {
    ...guard,
    skips: [skip, ...guard.skips].slice(0, SKIP_ROOM),
    count: guard.count + 1,
    savedMs: guard.savedMs + run.ms,
    savedChars: guard.savedChars + Math.max(0, run.chars - skip.reply.length),
  }
}

/** About four characters per token, as for English text and code. */
const tokensOf = (chars: number): number => Math.round(chars / 4)

/** The switch row's right side: `3 skipped · 2m 5s · ~800 tokens`; empty before the first skip. */
export function savedText(guard: Guard): string {
  if (guard.count === 0) return ''
  const tokens = tokensOf(guard.savedChars)

  return [`${guard.count} skipped`, duration(guard.savedMs), ...(tokens > 0 ? [`~${tokens.toLocaleString('en-US')} tokens`] : [])].join(' · ')
}

/** A skip row's text: `Build skipped, same as 4m 2s earlier`. */
export function skipText(skip: GuardSkip): string {
  const what = skip.kinds.includes('build') && skip.kinds.includes('test') ? 'Build and tests' : skip.kinds.includes('test') ? 'Tests' : 'Build'

  return `${what} skipped, same as ${duration(skip.at - skip.from)} earlier`
}
