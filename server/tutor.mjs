// Tutor server: the one place that holds the API key when running locally.
// POST /api/tutor takes { messages } from the help chat and hands it to the
// tutor service (tutorService.mjs), which checks it, rate limits by remote
// address and asks Claude with the server's own prompt and tools. It replies
// { content, stop_reason }, or { error } with not_configured, busy,
// rate_limited, failed or bad_request. The hosted site uses api/tutor.mjs
// instead, with the same service.
//
// npm run tutor. TUTOR_PORT (default 7300). Credentials come from
// ANTHROPIC_API_KEY (read from .env.local when it is there) or an
// `ant auth login` profile. TUTOR_PROVIDER=gemini asks Gemini instead
// (GEMINI_API_KEY, GEMINI_MODEL; server/gemini.mjs translates the messages).
// TUTOR_FAKE=1 answers with fixed replies and makes no API calls.
//
// A newer start takes over: a running server writes its pid and a random
// token to a file in the temp folder, and a server that finds the port taken
// sends that token to POST /api/tutor/stop, waits for the port and starts.
// A browser cannot read the file, so no page can stop the server.
import http from 'node:http'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAX_BODY_BYTES } from './tutorCore.mjs'
import { createTutorService, log } from './tutorService.mjs'

const envFile = fileURLToPath(new URL('../.env.local', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const PORT = Number(process.env.TUTOR_PORT) || 7300
const tutor = createTutorService(process.env)

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function handle(req, res) {
  if (req.method === 'POST' && req.url === '/api/tutor/stop' && req.headers['x-tutor-token'] === TOKEN) {
    send(res, 200, { stopping: true })
    console.log('Stopping: a newer tutor server is taking over.')
    res.on('finish', () => {
      server.close()
      process.exit(0)
    })
    return
  }
  // Opening the server in a browser (the preview tab) says what it is.
  if (req.method === 'GET' && req.url === '/') {
    const ready = tutor.describe()
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`Sparkit tutor server, running: ${ready}.\n\nThis server only answers the help chat. Open the course from the dev server (npm run dev, usually http://localhost:7100/) and use the Ask tab.\n`)
    return
  }
  if (req.method !== 'POST' || req.url !== '/api/tutor') {
    send(res, 404, { error: 'not_found' })
    log(404)
    return
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      send(res, 413, { error: 'too_large' })
      log(413)
      req.destroy()
      return
    }
    chunks.push(chunk)
  }
  let body
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    send(res, 400, { error: 'bad_request' })
    log(400)
    return
  }
  const reply = await tutor.answer(body, req.socket.remoteAddress)
  send(res, reply.status, reply.body)
}

const LOCK = join(tmpdir(), `robo-learn-tutor-${PORT}.json`)
const TOKEN = randomBytes(24).toString('hex')
const TAKEOVER_TRIES = 20

// Asks the tutor server recorded in the lock file to stop. False when there is
// none, or it did not answer (then the port belongs to something else).
async function stopOlder() {
  let lock
  try {
    lock = JSON.parse(readFileSync(LOCK, 'utf8'))
  } catch {
    return false
  }
  try {
    const response = await fetch(`http://localhost:${PORT}/api/tutor/stop`, { method: 'POST', headers: { 'x-tutor-token': String(lock.token) } })
    if (!response.ok) return false
    console.log(`Stopped the tutor server already running (pid ${lock.pid}).`)
    return true
  } catch {
    return false
  }
}

await tutor.setUp({ label: `Tutor server on port ${PORT}` })
const server = http.createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) send(res, 502, { error: 'failed' })
    log(502)
  })
})
let tries = 0
let askedOlder = false
server.on('listening', () => {
  writeFileSync(LOCK, JSON.stringify({ pid: process.pid, token: TOKEN }))
  process.on('exit', () => {
    try {
      if (JSON.parse(readFileSync(LOCK, 'utf8')).token === TOKEN) rmSync(LOCK)
    } catch {
      // Gone already, or a newer server's file.
    }
  })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0))
})
server.on('error', async (error) => {
  if (error.code !== 'EADDRINUSE') throw error
  if (!askedOlder) {
    askedOlder = true
    if (!(await stopOlder())) {
      console.log(`Port ${PORT} is already in use by something that is not a tutor server this one can stop. Stop it first.`)
      process.exitCode = 1
      return
    }
  }
  if (++tries > TAKEOVER_TRIES) {
    console.log(`Port ${PORT} is still in use. Stop the other tutor server first.`)
    process.exitCode = 1
    return
  }
  setTimeout(() => server.listen(PORT), 250)
})
server.listen(PORT)
