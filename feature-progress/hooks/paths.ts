/** Forward slashes everywhere, so Windows and POSIX paths compare alike. */
export const norm = (path: string): string => path.replace(/\\/g, '/')

/** An absolute path: a POSIX root, a drive letter, or a UNC share. */
export const isAbsolute = (path: string): boolean => /^(\/|[a-zA-Z]:\/|\/\/)/.test(norm(path))

/** A folder and a relative path joined with one slash; a leading `./` and trailing slashes drop. */
export function join(folder: string, path: string): string {
  const head = norm(folder).replace(/\/+$/, '')
  const tail = norm(path).replace(/^(\.\/)+/, '').replace(/^\/+/, '')

  if (tail === '') return head

  return head === '' ? tail : `${head}/${tail}`
}

/** `path` as an absolute, normalized path; a relative path resolves from `cwd`. */
export function absolute(cwd: string, path: string): string {
  if (isAbsolute(path)) return norm(path).replace(/(.)\/+$/, '$1')

  return join(cwd, path).replace(/(.)\/+$/, '$1')
}
