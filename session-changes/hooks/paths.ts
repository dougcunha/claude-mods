/** Forward slashes everywhere, so Windows and POSIX paths compare alike. */
export const norm = (path: string): string => path.replace(/\\/g, '/')

const isDrive = (path: string): boolean => /^[a-zA-Z]:\//.test(path)

const isAbsolute = (path: string): boolean => /^([a-zA-Z]:)?\//.test(norm(path))

/** The key a file is tracked under: absolute, normalized, case-folded on a drive path. */
export const keyOf = (path: string): string => (isDrive(norm(path)) ? norm(path).toLowerCase() : norm(path))

export function absolute(cwd: string, path: string): string {
  if (isAbsolute(path)) return norm(path)

  return `${norm(cwd).replace(/\/$/, '')}/${norm(path).replace(/^\.\//, '')}`
}

/** The path relative to `dir` when it lies under it; else the absolute path. */
export function relativeTo(dir: string, path: string): string {
  const prefix = `${norm(dir).replace(/\/$/, '')}/`
  const full = norm(path)
  const isUnder = isDrive(prefix)
    ? full.toLowerCase().startsWith(prefix.toLowerCase())
    : full.startsWith(prefix)

  return isUnder ? full.slice(prefix.length) : full
}

export const baseName = (path: string): string => norm(path).split('/').pop() ?? path

/** FNV-1a, enough to give each tracked file a distinct snapshot name. */
export function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }

  return (h >>> 0).toString(16).padStart(8, '0')
}
