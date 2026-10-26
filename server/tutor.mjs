// Tutor server: the one place that holds the API key. POST /api/tutor takes
// { messages } from the help chat, checks it (tutorCore.mjs), rate limits by
// remote address and asks Claude with the server's own prompt and tools. It
// replies { content, stop_reason }, or { error } with not_configured, busy,
// rate_limited, failed or bad_request. One log line per request: time,
// status, stop reason and token usage. Message text is never logged.
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
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI, ApiError } from '@google/genai'
import { validateRequest, buildApiRequest, createRateLimiter, fakeReply, MAX_BODY_BYTES, MODEL } from './tutorCore.mjs'
import { buildGeminiRequest, fromGeminiResponse, GEMINI_MODEL } from './gemini.mjs'

const envFile = fileURLToPath(new URL('../.env.local', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const PORT = Number(process.env.TUTOR_PORT) || 7300
const FAKE = process.env.TUTOR_FAKE === '1'
const PROVIDER = process.env.TUTOR_PROVIDER === 'gemini' ? 'gemini' : 'claude'
const GEMINI = process.env.GEMINI_MODEL || GEMINI_MODEL
const GEMINI_RETRIES = 2
const limiter = createRateLimiter({ perTenMinutes: 20, perDay: 300 })

function log(status, stopReason = '-', usage = null) {
  const tokens = usage
    ? `in=${usage.input_tokens} out=${usage.output_tokens} cache_read=${usage.cache_read_input_tokens || 0} cache_write=${usage.cache_creation_input_tokens || 0}`
    : '-'
  console.log(`${new Date().toISOString()} ${status} ${stopReason} ${tokens}`)
}

// The client, or null when there are no credentials. A cheap model lookup at
// start tells; it uses no tokens.
let client = null
let gemini = null
let configured = false
async function setUp() {
  if (FAKE) {
    console.log(`Tutor server on port ${PORT}, fake replies (TUTOR_FAKE=1), no API calls.`)
    return
  }
  if (PROVIDER === 'gemini') {
    await setUpGemini()
    return
  }
  try {
    client = new Anthropic()
    await client.models.retrieve(MODEL)
    configured = true
    console.log(`Tutor server on port ${PORT}, model ${MODEL}.`)
  } catch (error) {
    // A network failure is not missing credentials; requests try again.
    configured = error instanceof Anthropic.APIConnectionError
    if (configured) console.log(`Tutor server on port ${PORT}, model ${MODEL}. The API could not be reached at start.`)
    else console.log(`Tutor server on port ${PORT}: no API credentials. Set ANTHROPIC_API_KEY in .env.local or run ant auth login. Every request answers not_configured.`)
  }
}

async function setUpGemini() {
  const apiKey = process.env.GEMINI_API_KEY
  const missing = `Tutor server on port ${PORT}: no Gemini key. Set GEMINI_API_KEY in .env.local. Every request answers not_configured.`
  if (!apiKey) {
    console.log(missing)
    return
  }
  gemini = new GoogleGenAI({ apiKey })
  try {
    await gemini.models.get({ model: GEMINI })
    configured = true
    console.log(`Tutor server on port ${PORT}, Gemini model ${GEMINI}.`)
  } catch (error) {
    // A rejected key is a 400, 401 or 403; anything else may pass later.
    configured = !(error instanceof ApiError && [400, 401, 403].includes(error.status))
    console.log(configured ? `Tutor server on port ${PORT}, Gemini model ${GEMINI}. The API could not be reached at start.` : missing)
  }
}

function geminiErrorReply(error) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return [500, 'not_configured']
    if (error.status === 429 || error.status === 503) return [503, 'busy']
  }
  return [502, 'failed']
}

// One reply from the provider: { content, stop_reason, usage } or { status, error }.
async function ask(messages) {
  if (PROVIDER === 'gemini') {
    // Gemini's "high demand" 503 is often gone in a second or two: try twice more.
    for (let attempt = 0; ; attempt++) {
      try {
        const reply = fromGeminiResponse(await gemini.models.generateContent(buildGeminiRequest(messages, GEMINI)), nextFakeId)
        return reply.error ? { status: 502, error: reply.error } : reply
      } catch (error) {
        if (error instanceof ApiError && error.status === 503 && attempt < GEMINI_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        }
        const [status, code] = geminiErrorReply(error)
        return { status, error: code, name: error instanceof ApiError ? `ApiError ${error.status}` : error && error.constructor ? error.constructor.name : 'error' }
      }
    }
  }
  try {
    const response = await client.beta.messages.create(buildApiRequest(messages))
    return { content: response.content, stop_reason: response.stop_reason, usage: response.usage }
  } catch (error) {
    const [status, code] = errorReply(error)
    return { status, error: code, name: error && error.constructor ? error.constructor.name : 'error' }
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

// Most specific first: credentials, then rate limits and overload, then the rest.
function errorReply(error) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return [500, 'not_configured']
  if (error instanceof Anthropic.RateLimitError) return [503, 'busy']
  if (error instanceof Anthropic.APIError && (error.status === 529 || error.status === 503)) return [503, 'busy']
  if (!(error instanceof Anthropic.AnthropicError)) return [500, 'not_configured']
  return [502, 'failed']
}

// Ids for fake tool uses and for Gemini calls that come without one.
let fakeCount = 0
const nextFakeId = () => `toolu_fake_${++fakeCount}`

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
  const checked = validateRequest(body, { provider: PROVIDER })
  if (!checked.ok) {
    send(res, 400, { error: 'bad_request' })
    log(400)
    return
  }
  if (!limiter.allow(req.socket.remoteAddress || 'unknown')) {
    send(res, 429, { error: 'rate_limited' })
    log(429)
    return
  }
  if (FAKE) {
    const reply = fakeReply(checked.messages, nextFakeId)
    send(res, 200, reply)
    log(200, reply.stop_reason)
    return
  }
  if (!configured) {
    send(res, 500, { error: 'not_configured' })
    log(500)
    return
  }
  const reply = await ask(checked.messages)
  if (reply.error) {
    send(res, reply.status, { error: reply.error })
    log(reply.status, reply.name || reply.error)
    return
  }
  send(res, 200, { content: reply.content, stop_reason: reply.stop_reason })
  log(200, reply.stop_reason, reply.usage)
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

await setUp()
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
