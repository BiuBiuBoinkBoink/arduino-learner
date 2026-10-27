// Tutor service: the provider side of POST /api/tutor, shared by the local
// tutor server (server/tutor.mjs) and the hosted function (api/tutor.mjs).
// It checks the request (tutorCore.mjs), rate limits by a key the caller
// passes (the remote address) and asks Claude or Gemini. One log line per
// request: time, status, stop reason and token usage. Message text is never
// logged.
//
// createTutorService(env) -> { setUp({ label, check }), answer(body, key), describe() }
// answer resolves to { status, body } with body { content, stop_reason } or
// { error } with not_configured, busy, rate_limited, failed or bad_request.
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI, ApiError } from '@google/genai'
import { validateRequest, buildApiRequest, createRateLimiter, fakeReply, MODEL } from './tutorCore.mjs'
import { buildGeminiRequest, fromGeminiResponse, GEMINI_MODEL } from './gemini.mjs'

const GEMINI_RETRIES = 2

export function log(status, stopReason = '-', usage = null) {
  const tokens = usage
    ? `in=${usage.input_tokens} out=${usage.output_tokens} cache_read=${usage.cache_read_input_tokens || 0} cache_write=${usage.cache_creation_input_tokens || 0}`
    : '-'
  console.log(`${new Date().toISOString()} ${status} ${stopReason} ${tokens}`)
}

// Most specific first: credentials, then rate limits and overload, then the rest.
function errorReply(error) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return [500, 'not_configured']
  if (error instanceof Anthropic.RateLimitError) return [503, 'busy']
  if (error instanceof Anthropic.APIError && (error.status === 529 || error.status === 503)) return [503, 'busy']
  if (!(error instanceof Anthropic.AnthropicError)) return [500, 'not_configured']
  return [502, 'failed']
}

function geminiErrorReply(error) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return [500, 'not_configured']
    if (error.status === 429 || error.status === 503) return [503, 'busy']
  }
  return [502, 'failed']
}

export function createTutorService(env = process.env) {
  const FAKE = env.TUTOR_FAKE === '1'
  const PROVIDER = env.TUTOR_PROVIDER === 'gemini' ? 'gemini' : 'claude'
  const GEMINI = env.GEMINI_MODEL || GEMINI_MODEL
  const limiter = createRateLimiter({ perTenMinutes: 20, perDay: 300 })

  // Ids for fake tool uses and for Gemini calls that come without one.
  let fakeCount = 0
  const nextFakeId = () => `toolu_fake_${++fakeCount}`

  // The client, or null when there are no credentials. With check, a cheap
  // model lookup tells; it uses no tokens. Without it (the hosted function,
  // which starts often) the first request finds out instead.
  let client = null
  let gemini = null
  let configured = false
  async function setUp({ label = 'Tutor', check = true } = {}) {
    if (FAKE) {
      console.log(`${label}, fake replies (TUTOR_FAKE=1), no API calls.`)
      return
    }
    if (PROVIDER === 'gemini') {
      await setUpGemini(label, check)
      return
    }
    try {
      client = new Anthropic(env.ANTHROPIC_API_KEY ? { apiKey: env.ANTHROPIC_API_KEY } : {})
      if (check) await client.models.retrieve(MODEL)
      configured = true
      console.log(`${label}, model ${MODEL}.`)
    } catch (error) {
      // A network failure is not missing credentials; requests try again.
      configured = error instanceof Anthropic.APIConnectionError
      if (configured) console.log(`${label}, model ${MODEL}. The API could not be reached at start.`)
      else console.log(`${label}: no API credentials. Set ANTHROPIC_API_KEY in .env.local or run ant auth login. Every request answers not_configured.`)
    }
  }

  async function setUpGemini(label, check) {
    const apiKey = env.GEMINI_API_KEY
    const missing = `${label}: no Gemini key. Set GEMINI_API_KEY in .env.local. Every request answers not_configured.`
    if (!apiKey) {
      console.log(missing)
      return
    }
    gemini = new GoogleGenAI({ apiKey })
    try {
      if (check) await gemini.models.get({ model: GEMINI })
      configured = true
      console.log(`${label}, Gemini model ${GEMINI}.`)
    } catch (error) {
      // A rejected key is a 400, 401 or 403; anything else may pass later.
      configured = !(error instanceof ApiError && [400, 401, 403].includes(error.status))
      console.log(configured ? `${label}, Gemini model ${GEMINI}. The API could not be reached at start.` : missing)
    }
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

  // body is the parsed request body; key is what the rate limiter counts by.
  async function answer(body, key) {
    const checked = validateRequest(body, { provider: PROVIDER })
    if (!checked.ok) {
      log(400)
      return { status: 400, body: { error: 'bad_request' } }
    }
    if (!limiter.allow(key || 'unknown')) {
      log(429)
      return { status: 429, body: { error: 'rate_limited' } }
    }
    if (FAKE) {
      const reply = fakeReply(checked.messages, nextFakeId)
      log(200, reply.stop_reason)
      return { status: 200, body: reply }
    }
    if (!configured) {
      log(500)
      return { status: 500, body: { error: 'not_configured' } }
    }
    const reply = await ask(checked.messages)
    if (reply.error) {
      log(reply.status, reply.name || reply.error)
      return { status: reply.status, body: { error: reply.error } }
    }
    log(200, reply.stop_reason, reply.usage)
    return { status: 200, body: { content: reply.content, stop_reason: reply.stop_reason } }
  }

  // What the service is ready to do, in a few words.
  function describe() {
    if (FAKE) return 'fake replies (TUTOR_FAKE=1), no API calls'
    if (!configured) return 'not configured: no API key, so the chat says it is not available'
    return PROVIDER === 'gemini' ? `Gemini model ${GEMINI}` : `Claude model ${MODEL}`
  }

  return { setUp, answer, describe }
}
