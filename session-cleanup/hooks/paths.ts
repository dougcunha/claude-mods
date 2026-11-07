/** Forward slashes everywhere, so Windows and POSIX paths compare alike; no trailing slash but on a root. */
export function norm(path: string): string {
  const slashed = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\/$/.test(slashed) || slashed === '/') return slashed

  return slashed.replace(/\/+$/, '')
}

const isDrive = (path: string): boolean => /^[a-zA-Z]:\//.test(path)

export const isAbsolute = (path: string): boolean => /^([a-zA-Z]:)?\//.test(norm(path))

/** The key a path is compared under: normalized, case-folded on a drive path. */
export const keyOf = (path: string): string => (isDrive(norm(path)) ? norm(path).toLowerCase() : norm(path))

/** `path` resolved against `cwd`, with `.` and `..` segments folded. */
export function absolute(cwd: string, path: string): string {
  const full = isAbsolute(path) ? norm(path) : `${norm(cwd).replace(/\/$/, '')}/${norm(path)}`
  const [head = '', ...rest] = full.split('/')
  const parts: string[] = []
  for (const part of rest) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }

  return `${head}/${parts.join('/')}`
}

/** Whether `path` is `dir` itself or lies under it. */
export function isUnder(dir: string, path: string): boolean {
  const d = keyOf(dir).replace(/\/$/, '')
  const p = keyOf(path)

  return p === d || p.startsWith(`${d}/`)
}

/** The path relative to `dir` when it lies under it; else the absolute path. */
export function relativeTo(dir: string, path: string): string {
  if (!isUnder(dir, path) || keyOf(dir) === keyOf(path)) return norm(path)

  return norm(path).slice(norm(dir).replace(/\/$/, '').length + 1)
}

export const baseName = (path: string): string => norm(path).split('/').pop() ?? path

/** The folder that holds `path`; a root is its own parent. */
export function parentOf(path: string): string {
  const full = norm(path)
  const cut = full.lastIndexOf('/')
  if (cut < 0) return full
  if (cut === 0) return '/'
  const parent = full.slice(0, cut)

  return /^[a-zA-Z]:$/.test(parent) ? `${parent}/` : parent
}

/** A path as the platform's own commands take it. */
export const nativeOf = (path: string, isWindows: boolean): string => (isWindows ? norm(path).replace(/\//g, '\\') : norm(path))

/** FNV-1a, a short stable key for a path. */
export function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }

  return (h >>> 0).toString(16).padStart(8, '0')
}

/** A size in bytes as a short text: 512 B, 3.2 KB, 14 MB. */
export function sizeText(bytes: number, isAtLeast = false): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const shown = unit === 0 || value >= 10 ? Math.round(value).toString() : value.toFixed(1)

  return `${isAtLeast ? '≥' : ''}${shown} ${units[unit]}`
}
