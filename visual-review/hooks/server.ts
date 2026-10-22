import type { Host } from './host'
import { fileUrl, norm } from './paths'

/** The platforms whose browser launch differs. */
export type Platform = 'windows' | 'mac' | 'linux'

/** One line the server prints on its standard output; any other line is dropped. */
export type ServerLine =
  | { type: 'ready'; url: string }
  | { type: 'error'; message: string }
  | { type: 'tick' }
  | { type: 'clients'; count: number }
  | { type: 'comments'; comments: unknown[] }
  | { type: 'submit' }

/** What a line buffer keeps between spawn chunks: the text after the last line break. */
export type LineBuffer = { lines: string[]; rest: string }

/** How the page opens: served by Node.js, or as a static file the browser reads from disk (FR-24). */
export type PageMode = 'server' | 'static'

/** The page URL the server prints: loopback, a port, and the token in the query. */
const READY_URL = /^http:\/\/127\.0\.0\.1:\d{1,5}\/\?t=[0-9a-f]{64}$/

/** What `node --version` prints: `v`, then the version. */
const NODE_VERSION = /^v\d+\.\d+\.\d+/

/** The page file that the server serves and the static page is made from. */
export const PAGE_FILE = 'index.html'

/** The files of the static page in the session folder: the page, and the view model as a classic script (DEC-06). */
export const STATIC_PAGE_FILE = 'review.html'
export const STATIC_VIEW_FILE = 'view.js'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The argv that starts the page server: Node.js on the PATH, the server file the mod ships, the session folder and the page folder. */
export function serverArgv(pluginRoot: string, sessionFolder: string): string[] {
  const root = norm(pluginRoot).replace(/\/+$/, '')

  return ['node', `${root}/server/server.mjs`, '--dir', sessionFolder, '--web', `${root}/web`]
}

/** Splits the text of a spawn chunk into whole lines, keeping a line that the chunk cut for the next chunk. */
export function splitLines(rest: string, text: string): LineBuffer {
  const parts = `${rest}${text}`.split(/\r?\n/)

  return { lines: parts.slice(0, -1).filter(line => line.trim() !== ''), rest: parts.at(-1) ?? '' }
}

/** Reads one server line from `unknown` JSON; a line that does not parse or has an unknown type is null. */
export function parseServerLine(line: string): ServerLine | null {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (!isRecord(value)) return null
  if (value.type === 'ready' && typeof value.url === 'string' && READY_URL.test(value.url)) return { type: 'ready', url: value.url }
  if (value.type === 'error' && typeof value.message === 'string') return { type: 'error', message: value.message }
  if (value.type === 'tick') return { type: 'tick' }
  if (value.type === 'clients' && typeof value.count === 'number' && Number.isInteger(value.count) && value.count >= 0) return { type: 'clients', count: value.count }
  // Each comment is narrowed where it is merged; here only the list itself is checked.
  if (value.type === 'comments' && Array.isArray(value.comments)) return { type: 'comments', comments: value.comments }
  if (value.type === 'submit') return { type: 'submit' }

  return null
}

/** The page mode from the `node --version` run: the server needs Node.js, so a run that failed or could not start is static. */
export function pageModeOf(nodeRun: { exitCode: number; stdout: string } | null): PageMode {
  return nodeRun !== null && nodeRun.exitCode === 0 && NODE_VERSION.test(nodeRun.stdout.trim()) ? 'server' : 'static'
}

/**
 * The static page from the served page: each page file loads by its `file://` URL under `webUrl`, without the token
 * query the server fills in, and the view model loads first from `view.js` next to the page, which sets `window.VIEW`.
 */
export function staticPageOf(pageHtml: string, webUrl: string): string {
  const base = webUrl.replace(/\/+$/, '')
  const linked = pageHtml.replace(/(href|src)="([\w./-]+)\?t=__REVIEW_TOKEN__"/g, (_, attribute: string, file: string) => `${attribute}="${base}/${file}"`)

  return linked.replace('<script ', `<script src="${STATIC_VIEW_FILE}"></script>\n    <script `)
}

/** The classic script that hands the view model to the static page. */
export const staticViewOf = (viewJson: string): string => `window.VIEW = ${viewJson}\n`

/**
 * Writes the static page of a view model into the session folder: `view.js` and `review.html` built from the page file
 * the mod ships. Returns the path of the page.
 */
export async function writeStaticPage(host: Host, { pluginRoot, folder, viewJson }: { pluginRoot: string; folder: string; viewJson: string }): Promise<string> {
  const web = `${norm(pluginRoot).replace(/\/+$/, '')}/web`
  const page = `${folder}/${STATIC_PAGE_FILE}`
  await host.writeFile(`${folder}/${STATIC_VIEW_FILE}`, staticViewOf(viewJson))
  await host.writeFile(page, staticPageOf(await host.readFile(`${web}/${PAGE_FILE}`), fileUrl(web)))

  return page
}

/** The platform, from the `OS` variable on Windows and `uname -s` elsewhere. */
export async function platformOf(host: Host): Promise<Platform> {
  if ((await host.env()).os === 'Windows_NT') return 'windows'
  const uname = await host.run(['uname', '-s']).catch(() => ({ exitCode: 1, stdout: '' }))

  return uname.stdout.trim() === 'Darwin' ? 'mac' : 'linux'
}

/**
 * The argv that opens a URL in the default browser; no shell, so the token never meets a command line parser. On Windows,
 * `explorer.exe` opens File Explorer for a URL with a query, so the URL goes to the protocol handler that the browser owns.
 */
export function browserArgv(platform: Platform, url: string): string[] {
  if (platform === 'windows') return ['rundll32', 'url.dll,FileProtocolHandler', url]

  return [platform === 'mac' ? 'open' : 'xdg-open', url]
}
