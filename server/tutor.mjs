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
import http from 'node:http'
import { existsSync } from 'node:fs'
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
    try {
      const reply = fromGeminiResponse(await gemini.models.generateContent(buildGeminiRequest(messages, GEMINI)), nextFakeId)
      return reply.error ? { status: 502, error: reply.error } : reply
    } catch (error) {
      const [status, code] = geminiErrorReply(error)
      return { status, error: code, name: error && error.constructor ? error.constructor.name : 'error' }
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

await setUp()
http.createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) send(res, 502, { error: 'failed' })
    log(502)
  })
}).listen(PORT)
