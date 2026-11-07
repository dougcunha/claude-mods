import { absolute, baseName, norm } from './paths'

/** Which shell reads the command: it decides what a backslash and a backtick mean. */
export type ShellKind = 'bash' | 'powershell'

/**
 * A path a shell command may create. `sources` is set for a copy or a move: when `path` is
 * an existing folder before the command, the new entries are `path/<base name of each source>`.
 */
export type ShellTarget = { path: string; isFolder: boolean; sources?: string[] }

/** What the parser needs to read paths: the folder the command starts in, the home folder and the environment. */
export type ShellContext = {
  kind: ShellKind
  cwd: string
  home?: string
  isWindows: boolean
  env: (name: string) => string | undefined
}

/** One word of a command, or a redirect operator whose next word is its target. */
type Token = { text: string; isRedirect?: true; isInput?: true }

/** Placeholders for `$`, `%` and `~` inside single quotes, so expansion leaves them alone. */
const LITERAL: Record<string, string> = { $: '\u{F0001}', '%': '\u{F0002}', '~': '\u{F0003}' }
const RESTORE = new Map(Object.entries(LITERAL).map(([char, mark]) => [mark, char]))

const protect = (text: string): string => text.replace(/[$%~]/g, char => LITERAL[char] ?? char)
const restore = (text: string): string => text.replace(/[\u{F0001}-\u{F0003}]/gu, mark => RESTORE.get(mark) ?? mark)

/** Splits a command into segments of tokens; `;`, `|`, `&&`, `||`, `&` and line breaks end a segment. */
export function tokenize(command: string, kind: ShellKind): Token[][] {
  const segments: Token[][] = []
  let tokens: Token[] = []
  let word = ''
  let hasWord = false
  const flush = (): void => {
    if (hasWord) tokens.push({ text: word })
    word = ''
    hasWord = false
  }
  const end = (): void => {
    flush()
    if (tokens.length > 0) segments.push(tokens)
    tokens = []
  }

  for (let i = 0; i < command.length; i++) {
    const char = command[i] ?? ''
    const after = command[i + 1] ?? ''
    if (char === ' ' || char === '\t' || char === '\r') flush()
    else if (char === '\n' || char === ';') end()
    else if (char === '|') {
      if (after === '|') i += 1
      end()
    } else if (char === '&') {
      if (after === '>') {
        flush()
        i += after === '>' && command[i + 2] === '>' ? 2 : 1
        tokens.push({ text: '>', isRedirect: true })
      } else {
        if (after === '&') i += 1
        end()
      }
    } else if (char === '>') {
      if (/^(\d+|\*)$/.test(word)) {
        word = ''
        hasWord = false
      }
      flush()
      if (after === '>') i += 1
      if (command[i + 1] === '&') {
        i += 1
        while (/\d/.test(command[i + 1] ?? '')) i += 1
      } else tokens.push({ text: '>', isRedirect: true })
    } else if (char === '<') {
      flush()
      tokens.push({ text: '<', isInput: true })
    } else if (char === "'") {
      hasWord = true
      let j = i + 1
      let quoted = ''
      for (; j < command.length; j++) {
        if (command[j] === "'") {
          if (kind === 'powershell' && command[j + 1] === "'") {
            quoted += "'"
            j += 1
            continue
          }
          break
        }
        quoted += command[j]
      }
      word += protect(quoted)
      i = j
    } else if (char === '"') {
      hasWord = true
      let j = i + 1
      for (; j < command.length && command[j] !== '"'; j++) {
        const inner = command[j] ?? ''
        const isEscape = (kind === 'bash' && inner === '\\') || (kind === 'powershell' && inner === '`')
        if (isEscape && j + 1 < command.length) {
          j += 1
          word += command[j]
        } else word += inner
      }
      i = j
    } else if (kind === 'bash' && char === '\\' && i + 1 < command.length) {
      hasWord = true
      i += 1
      word += command[i]
    } else if (kind === 'powershell' && char === '`' && i + 1 < command.length) {
      hasWord = true
      i += 1
      word += command[i]
    } else {
      hasWord = true
      word += char
    }
  }
  end()

  return segments
}

/** The names a word may not be: the null devices and a dash for standard output. */
const NOT_A_PATH = /^(\/dev\/(null|stdout|stderr|tty)|nul|\$null|-|con)$/i

/** Expands `~`, `$env:NAME`, `${NAME}`, `$NAME` and `%NAME%`; undefined when a variable is unknown or a substitution remains. */
export function expand(word: string, context: ShellContext): string | undefined {
  if (NOT_A_PATH.test(word)) return undefined
  let text = word
  if (/^~(\/|\\|$)/.test(text)) {
    if (context.home === undefined) return undefined
    text = context.home + text.slice(1)
  }
  let isKnown = true
  const look = (name: string): string => {
    const value = context.env(name)
    if (value === undefined) isKnown = false
    return value ?? ''
  }
  text = text
    .replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/gi, (_, name: string) => look(name))
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => look(name))
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name: string) => look(name))
    .replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (_, name: string) => look(name))
  if (!isKnown || /[$`*?]/.test(text) || text.includes('%')) return undefined
  text = restore(text)
  if (text === '' || NOT_A_PATH.test(text)) return undefined
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return undefined

  return text
}

/** A Git Bash path such as `/c/Users/x` as the drive path `C:/Users/x`. */
function driveOf(path: string, isWindows: boolean): string {
  const match = isWindows ? /^\/([a-zA-Z])(\/.*|$)/.exec(norm(path)) : null

  return match ? `${(match[1] ?? '').toUpperCase()}:${match[2] === '' ? '/' : match[2]}` : path
}

/** A word as an absolute path, or undefined when it cannot be read as one. */
function pathOf(word: string, cwd: string, context: ShellContext): string | undefined {
  const text = expand(word, context)

  return text === undefined ? undefined : absolute(cwd, driveOf(text, context.isWindows))
}

/** The command name of a segment: leading assignments and wrappers skipped, the folder and `.exe` cut, lower case. */
function commandOf(tokens: Token[]): { name: string; args: Token[] } {
  let start = 0
  while (start < tokens.length) {
    const text = tokens[start]?.text ?? ''
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(text) || ['sudo', 'env', 'command', 'exec', 'time', 'nohup', '&', '.'].includes(text)) start += 1
    else break
  }
  const raw = tokens[start]?.text ?? ''
  const name = baseName(raw).toLowerCase().replace(/\.exe$/, '')

  return { name, args: tokens.slice(start + 1) }
}

/** PowerShell parameters that take a value, so the word after them is no positional argument. */
const VALUE_PARAMS = [
  'path', 'literalpath', 'filepath', 'destination', 'destinationpath', 'outfile', 'value', 'itemtype', 'type', 'name', 'encoding',
  'width', 'delimiter', 'inputobject', 'filter', 'include', 'exclude', 'credential', 'method', 'headers', 'body', 'uri', 'stream',
  'useculture', 'contenttype', 'usebasicparsing', 'timeoutsec', 'variable', 'outvariable', 'erroraction', 'warningaction',
]

/** Switch parameters that look like value parameters by prefix but take no value. */
const SWITCHES = ['force', 'append', 'noclobber', 'nonewline', 'recurse', 'passthru', 'whatif', 'confirm', 'notypeinformation', 'usebasicparsing']

type Parsed = { named: Map<string, string>; positional: string[] }

/** Reads PowerShell-style arguments: `-Name value`, `-Name:value`, switches and positional words. */
function parseArgs(args: Token[]): Parsed {
  const named = new Map<string, string>()
  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === undefined || token.isRedirect || token.isInput) {
      i += 1
      continue
    }
    const match = /^-([A-Za-z][A-Za-z0-9]*)(?::(.*))?$/.exec(token.text)
    if (match === null) {
      positional.push(token.text)
      continue
    }
    const flag = (match[1] ?? '').toLowerCase()
    if (match[2] !== undefined) {
      named.set(flag, match[2])
      continue
    }
    const isSwitch = SWITCHES.includes(flag)
    const param = isSwitch ? undefined : VALUE_PARAMS.find(name => name.startsWith(flag))
    if (param !== undefined && i + 1 < args.length) {
      named.set(param, args[i + 1]?.text ?? '')
      i += 1
    } else named.set(flag, '')
  }

  return { named, positional }
}

/** The value of the first named parameter whose name starts with one of `names`, by the full name. */
function namedOf(parsed: Parsed, names: string[]): string | undefined {
  for (const [flag, value] of parsed.named) {
    if (value !== '' && names.some(name => name.startsWith(flag) || flag === name)) return value
  }

  return undefined
}

/** The words of POSIX-style arguments that are not options; `--` ends the options. */
function operands(args: Token[], valueFlags: string[] = []): string[] {
  const words: string[] = []
  let isOptionsDone = false
  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === undefined) continue
    if (token.isRedirect || token.isInput) {
      i += 1
      continue
    }
    if (!isOptionsDone && token.text === '--') {
      isOptionsDone = true
      continue
    }
    if (!isOptionsDone && token.text.startsWith('-') && token.text.length > 1) {
      if (valueFlags.includes(token.text)) i += 1
      continue
    }
    words.push(token.text)
  }

  return words
}

/** The folder a `git clone` writes: the given one, or the repository's name. */
function cloneFolder(words: string[]): string | undefined {
  const [, source, folder] = words
  if (folder !== undefined) return folder
  if (source === undefined) return undefined
  const name = source.replace(/[\\/]+$/, '').split(/[\\/:]/).pop()?.replace(/\.git$/, '')

  return name === undefined || name === '' ? undefined : name
}

/** The paths one segment writes, as raw words; `folders` holds the words that name a folder. */
function segmentTargets(name: string, args: Token[]): { words: string[]; folders: string[]; copies: { dest: string; sources: string[] }[] } {
  const words: string[] = []
  const folders: string[] = []
  const copies: { dest: string; sources: string[] }[] = []
  args.forEach((token, i) => {
    if (token.isRedirect && args[i + 1] !== undefined) words.push(args[i + 1]?.text ?? '')
  })
  const parsed = parseArgs(args)
  const first = (names: string[]): string | undefined => namedOf(parsed, names) ?? parsed.positional[0]

  switch (name) {
    case 'touch':
      words.push(...operands(args, ['-d', '-r', '-t']))
      break
    case 'mkdir':
    case 'md':
      folders.push(...operands(args, ['-m', '--mode']).filter(word => !/^-/.test(word)))
      break
    case 'new-item':
    case 'ni': {
      const path = first(['path'])
      const leaf = namedOf(parsed, ['name'])
      const type = (namedOf(parsed, ['itemtype', 'type']) ?? '').toLowerCase()
      const full = path === undefined ? leaf : leaf === undefined ? path : `${path}/${leaf}`
      if (full !== undefined) (type.startsWith('dir') ? folders : words).push(full)
      break
    }
    case 'set-content':
    case 'sc':
    case 'add-content':
    case 'ac':
    case 'export-csv':
    case 'epcsv':
    case 'export-clixml': {
      const path = first(['path', 'literalpath'])
      if (path !== undefined) words.push(path)
      break
    }
    case 'out-file':
    case 'tee-object': {
      const path = first(['filepath', 'literalpath', 'path'])
      if (path !== undefined) words.push(path)
      break
    }
    case 'tee':
      words.push(...operands(args))
      break
    case 'cp':
    case 'mv':
    case 'copy':
    case 'move':
    case 'copy-item':
    case 'cpi':
    case 'move-item':
    case 'mi': {
      const isPowerShell = name.includes('-') || name === 'cpi' || name === 'mi' || name === 'copy' || name === 'move'
      const list = isPowerShell ? parsed.positional : operands(args, ['-t', '--target-directory', '-S', '--suffix'])
      const dest = (isPowerShell ? namedOf(parsed, ['destination']) : undefined) ?? (list.length >= 2 ? list[list.length - 1] : undefined)
      const sources = isPowerShell ? [namedOf(parsed, ['path', 'literalpath']) ?? list[0]].filter(word => word !== undefined) : list.slice(0, -1)
      if (dest !== undefined) copies.push({ dest, sources: sources as string[] })
      break
    }
    case 'curl':
      args.forEach((token, i) => {
        if ((token.text === '-o' || token.text === '--output') && args[i + 1] !== undefined) words.push(args[i + 1]?.text ?? '')
      })
      break
    case 'wget':
      args.forEach((token, i) => {
        if ((token.text === '-O' || token.text === '--output-document') && args[i + 1] !== undefined) words.push(args[i + 1]?.text ?? '')
      })
      break
    case 'invoke-webrequest':
    case 'iwr':
    case 'invoke-restmethod':
    case 'irm': {
      const out = namedOf(parsed, ['outfile'])
      if (out !== undefined) words.push(out)
      break
    }
    case 'expand-archive': {
      const out = namedOf(parsed, ['destinationpath']) ?? parsed.positional[1]
      if (out !== undefined) folders.push(out)
      break
    }
    case 'unzip':
      args.forEach((token, i) => {
        if (token.text === '-d' && args[i + 1] !== undefined) folders.push(args[i + 1]?.text ?? '')
      })
      break
    case 'git': {
      const list = operands(args, ['-C', '-c', '-b', '--branch', '--depth', '-o', '--origin', '--template', '--reference', '-j', '--jobs', '--filter'])
      if (list[0] === 'clone') {
        const folder = cloneFolder(list)
        if (folder !== undefined) folders.push(folder)
      }
      break
    }
    case 'virtualenv':
      folders.push(...operands(args, ['-p', '--python', '--prompt']).slice(0, 1))
      break
    default:
      if (/^python(\d+(\.\d+)*)?$|^py$/.test(name)) {
        const at = args.findIndex((token, i) => token.text === '-m' && args[i + 1]?.text === 'venv')
        if (at >= 0) folders.push(...operands(args.slice(at + 2), ['--prompt']).slice(0, 1))
      }
  }

  return { words, folders, copies }
}

/** The folder a `cd`-like segment moves to, or undefined when the segment is no move. */
function moveOf(name: string, args: Token[], cwd: string, context: ShellContext): string | undefined {
  if (!['cd', 'chdir', 'set-location', 'sl', 'pushd', 'push-location'].includes(name)) return undefined
  const parsed = parseArgs(args)
  const word = namedOf(parsed, ['path', 'literalpath']) ?? parsed.positional[0]
  if (word === undefined) return context.home ?? cwd
  if (word === '-') return cwd

  return pathOf(word, cwd, context) ?? cwd
}

/** The paths a shell command may create, read from its words; a best effort that misses what scripts and programs write. */
export function shellTargets(command: string, context: ShellContext): ShellTarget[] {
  const found = new Map<string, ShellTarget>()
  let cwd = context.cwd
  const add = (word: string, isFolder: boolean, sources?: string[]): void => {
    const path = pathOf(word, cwd, context)
    if (path === undefined) return
    const resolved = sources?.map(source => pathOf(source, cwd, context)).filter((one): one is string => one !== undefined)
    found.set(path, { path, isFolder, ...(resolved === undefined ? {} : { sources: resolved }) })
  }
  for (const segment of tokenize(command, context.kind)) {
    const { name, args } = commandOf(segment)
    const moved = moveOf(name, args, cwd, context)
    if (moved !== undefined) {
      cwd = moved
      continue
    }
    const targets = segmentTargets(name, args)
    for (const word of targets.words) add(word, false)
    for (const word of targets.folders) add(word, true)
    for (const copy of targets.copies) add(copy.dest, false, copy.sources)
    // A redirect before the command name (`> out.txt echo x`) still writes.
    if (segment[0]?.isRedirect && segment[1] !== undefined) add(segment[1].text, false)
  }

  return [...found.values()]
}
