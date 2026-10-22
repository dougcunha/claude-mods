// The page server of visual-review. The mod starts it with `node server.mjs --dir <session folder> --web <page folder>`.
// It uses Node.js built-ins only, binds 127.0.0.1 on a free port, serves the page and the view model to a request that
// carries its token, pushes each new view model to the open tabs, and talks to the mod by JSON lines on standard output.
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, watch } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'

/** The view model file the mod writes in the session folder. */
const VIEW_FILE = 'view.json'

/** A write is not atomic, so a view model that does not parse is read again after this wait, a few times. */
const VIEW_RETRY_MS = 100
const VIEW_RETRIES = 5

/** How often the server tells the mod it lives; the mod's read loop can stop only when a line arrives. */
const TICK_MS = 1_000

/** How often an open event stream gets a comment, so no proxy or browser closes it for silence. */
const KEEP_ALIVE_MS = 15_000

/** The largest body a POST of the page may carry. */
const BODY_LIMIT_BYTES = 1024 * 1024

/** The text in the page files that the server replaces with the token, so the page's own requests carry it. */
const TOKEN_PLACEHOLDER = '__REVIEW_TOKEN__'

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

/** Loads nothing from another origin: the page works offline and a script cannot send data away (NFR-02). */
const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
}

function print(line) {
  process.stdout.write(`${JSON.stringify(line)}\n`)
}

function argument(name) {
  const at = process.argv.indexOf(name)

  return at < 0 ? undefined : process.argv[at + 1]
}

const sessionFolder = argument('--dir')
const webFolder = argument('--web')
if (sessionFolder === undefined || webFolder === undefined) {
  print({ type: 'error', message: 'the server needs --dir and --web' })
  process.exit(2)
}

// The mod's read loop is the server's life: when it ends, the pipe closes and the next write fails.
process.stdout.on('error', () => process.exit(0))
process.on('uncaughtException', error => {
  print({ type: 'error', message: String(error && error.message ? error.message : error) })
  process.exit(1)
})

const webRoot = resolve(webFolder)
const viewPath = join(sessionFolder, VIEW_FILE)
const token = randomBytes(32).toString('hex')
const tokenBytes = Buffer.from(token)
const clients = new Set()
let port = 0
let lastView = null

/** Compares in constant time; the byte lengths go first, because a non-ASCII value of the same character count throws. */
function isToken(value) {
  if (typeof value !== 'string') return false
  const bytes = Buffer.from(value)
  return bytes.length === tokenBytes.length && timingSafeEqual(bytes, tokenBytes)
}

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type })
  response.end(body)
}

function decoded(text) {
  try {
    return decodeURIComponent(text)
  } catch {
    return '\0'
  }
}

function sendStatic(pathname, response) {
  const name = pathname === '/' ? 'index.html' : decoded(pathname.slice(1))
  const path = resolve(webRoot, name)
  // A path outside the page folder, by `..` or an absolute name, is not found.
  if (name.includes('\0') || !path.startsWith(webRoot + sep)) return send(response, 404, 'Not found')
  readFile(path, (error, bytes) => {
    if (error) return send(response, 404, 'Not found')
    const type = CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
    const body = extname(path).toLowerCase() === '.html' ? bytes.toString('utf8').replaceAll(TOKEN_PLACEHOLDER, token) : bytes
    send(response, 200, body, type)
  })
}

function sendView(response) {
  readFile(viewPath, 'utf8', (error, text) => (error ? send(response, 404, 'No view model yet') : send(response, 200, text, CONTENT_TYPES['.json'])))
}

function openEvents(request, response) {
  response.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive' })
  response.write(': connected\n\n')
  clients.add(response)
  print({ type: 'clients', count: clients.size })
  request.on('close', () => {
    clients.delete(response)
    print({ type: 'clients', count: clients.size })
  })
}

/**
 * Relays a POST of the page to the mod as 1 line: the comment set (`/comments`) or the submit (`/submit`). A POST needs
 * the token in the `X-Review-Token` header, which a page of another origin cannot send without a preflight this server
 * never answers.
 */
function receive(request, response, pathname) {
  if (!isToken(request.headers['x-review-token'])) return send(response, 403, 'Forbidden')
  if (pathname !== '/comments' && pathname !== '/submit') return send(response, 404, 'Not found')
  const chunks = []
  let size = 0
  request.on('data', chunk => {
    size += chunk.length
    if (size > BODY_LIMIT_BYTES) {
      send(response, 413, 'Too large')
      request.destroy()
      return
    }
    chunks.push(chunk)
  })
  request.on('end', () => {
    if (size > BODY_LIMIT_BYTES) return
    if (pathname === '/submit') {
      print({ type: 'submit' })
      return send(response, 202, 'Review sent')
    }
    let body
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      return send(response, 400, 'Bad JSON')
    }
    if (body === null || typeof body !== 'object' || !Array.isArray(body.comments)) return send(response, 400, 'Expected { comments: [...] }')
    print({ type: 'comments', comments: body.comments })
    send(response, 204, '')
  })
}

function isJson(text) {
  try {
    JSON.parse(text)

    return true
  } catch {
    return false
  }
}

/** Reads the view model again after a change and sends it to every open tab once; the same content twice is sent once. */
function pushView(attempt) {
  readFile(viewPath, 'utf8', (error, text) => {
    if (error || !isJson(text)) {
      if (attempt < VIEW_RETRIES) setTimeout(() => pushView(attempt + 1), VIEW_RETRY_MS)

      return
    }
    if (text === lastView) return
    lastView = text
    const event = `event: model\n${text.split('\n').map(line => `data: ${line}`).join('\n')}\n\n`
    for (const client of clients) client.write(event)
  })
}

const server = createServer((request, response) => {
  // Only this loopback address and port, which a page of another name (DNS rebinding) never sends.
  if (request.headers.host !== `127.0.0.1:${port}`) return send(response, 403, 'Forbidden')
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
  if (!isToken(url.searchParams.get('t') ?? request.headers['x-review-token'])) return send(response, 403, 'Forbidden')
  if (request.method === 'POST') return receive(request, response, url.pathname)
  if (request.method !== 'GET') return send(response, 405, 'Method not allowed')
  if (url.pathname === '/view') return sendView(response)
  if (url.pathname === '/events') return openEvents(request, response)

  return sendStatic(url.pathname, response)
})

server.on('error', error => {
  print({ type: 'error', message: error.message })
  process.exit(1)
})

readFile(viewPath, 'utf8', (error, text) => {
  lastView = error ? null : text
  watch(sessionFolder, (event, name) => {
    if (name === null || name === VIEW_FILE) pushView(0)
  })
  server.listen(0, '127.0.0.1', () => {
    port = server.address().port
    print({ type: 'ready', url: `http://127.0.0.1:${port}/?t=${token}` })
  })
})

setInterval(() => print({ type: 'tick' }), TICK_MS)
setInterval(() => {
  for (const client of clients) client.write(': keep-alive\n\n')
}, KEEP_ALIVE_MS)
