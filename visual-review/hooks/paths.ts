/** Forward slashes everywhere, so Windows and POSIX paths compare alike. */
export const norm = (path: string): string => path.replace(/\\/g, '/')

/** The temporary directory: `TEMP`, else `TMPDIR`, else `/tmp`, as the environment names it. */
export const tempRoot = (env: { temp?: string; tmpdir?: string }): string => norm(env.temp ?? env.tmpdir ?? '/tmp').replace(/\/+$/, '')

/** The `file://` URL of an absolute path, Windows (`C:\x`) or POSIX (`/x`), with each name percent-encoded but the drive. */
export function fileUrl(path: string): string {
  const parts = norm(path).split('/')
  const encoded = parts.map((part, index) => (index === 0 && /^[a-zA-Z]:$/.test(part) ? part : encodeURIComponent(part))).join('/')

  return encoded.startsWith('/') ? `file://${encoded}` : `file:///${encoded}`
}

/** The folder of the mod's files for one session: `<temp>/claude-visual-review/<session id>` (`mod-runtime.md`, "Files"). */
export const sessionDir = (temp: string, sessionId: string): string => `${norm(temp).replace(/\/+$/, '')}/claude-visual-review/${sessionId}`
