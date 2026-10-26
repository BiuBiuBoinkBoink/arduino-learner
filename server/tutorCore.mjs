// Tutor server core: the system prompt, request validation, the API request
// and a rate limiter. Pure (no network, no clock unless one is passed in), so
// it is unit tested; server/tutor.mjs does the HTTP side.
//
// validateRequest(body, { provider }) -> { ok: true, messages } | { ok: false, error }
// buildApiRequest(messages) -> the client.beta.messages.create request
// createRateLimiter({ perTenMinutes, perDay, now }) -> { allow(key) }
import { TOOL_DEFINITIONS, TOOL_NAMES } from '../src/tutor/toolDefs.js'

export const MODEL = 'claude-opus-5-5'
export const MAX_BODY_BYTES = 200 * 1024
export const MAX_MESSAGES = 80
export const MAX_TEXT = 8000
export const MAX_RESULT = 4000
export const MAX_ASSISTANT_JSON = 40000

export const SYSTEM_PROMPT = `You are the help chat inside Robo Learn, a browser course that teaches Arduino on a simulated Uno and breadboard. You help one learner with the lesson step they are on. Learners may be young, so keep everything suitable for school.

How to help
- Guide, do not solve. Ask one short question back, point at the right place, or show something with a tool.
- Give exact holes or exact wiring only when the state says exact_positions_allowed is true. Even then, show one way and let the learner do it.
- Keep replies under 80 words, in plain words and short sentences. No emoji, no exclamation marks, no headings, no tables.
- Show instead of describing when a tool can do it. Use at most four tools in one reply.
- Never state a measurement, timing or result that did not come from a tool result or the state. When you need a number, use scope, measure, trace_current or what_if.
- The workbench_state block in each learner message is the truth about the circuit, the code and the progress. If it disagrees with the learner, say what you see in the state.
- Never write a whole sketch or the full answer to a code step. suggest_code is only for Serial.print or Serial.println lines that help find a problem.
- You cannot place parts or edit code. The learner does that.
- When a step passes, say so briefly and point to Continue.

Staying on topic
- Talk about this course, electronics, Arduino and programming. If asked about anything else, say in one sentence that you can only help with the course, then return to the step.
- If the learner mentions mains electricity, lithium batteries or anything else that could hurt them, give a short safety note: the course parts run on 5 V, and they should ask an adult before working with anything stronger.
- Never ask for or repeat personal details such as names, ages, schools or addresses.`

// Blocks the API returns that go back to it unchanged. fallback marks where a
// server side fallback model took over (non streaming replies leave out the
// declined part, so the content can be echoed as it is).
const ASSISTANT_TYPES = ['text', 'tool_use', 'thinking', 'redacted_thinking', 'fallback']
// With TUTOR_PROVIDER=gemini a model turn also carries Gemini's raw parts
// (server/gemini.mjs), sent back to Gemini unchanged.
const GEMINI_TYPES = ['gemini_parts']

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const onlyKeys = (value, keys) => Object.keys(value).every((key) => keys.includes(key))
const fail = (error) => ({ ok: false, error })

function checkUserBlock(block) {
  if (!isObject(block)) return 'a user block is not an object'
  if (block.type === 'text') {
    if (!onlyKeys(block, ['type', 'text']) || typeof block.text !== 'string') return 'a text block has the wrong shape'
    if (block.text.length === 0 || block.text.length > MAX_TEXT) return 'a text block is empty or too long'
    return null
  }
  if (block.type === 'tool_result') {
    if (!onlyKeys(block, ['type', 'tool_use_id', 'content', 'is_error'])) return 'a tool result has unknown fields'
    if (typeof block.tool_use_id !== 'string' || block.tool_use_id.length === 0) return 'a tool result has no tool_use_id'
    if (typeof block.content !== 'string' || block.content.length > MAX_RESULT) return 'a tool result content is not a short string'
    if (block.is_error !== undefined && typeof block.is_error !== 'boolean') return 'a tool result is_error is not a boolean'
    return null
  }
  return 'a user block has an unknown type'
}

function checkAssistantBlock(block, provider) {
  const types = provider === 'gemini' ? [...ASSISTANT_TYPES, ...GEMINI_TYPES] : ASSISTANT_TYPES
  if (!isObject(block) || !types.includes(block.type)) return 'an assistant block has an unknown type'
  if (block.type === 'gemini_parts' && !Array.isArray(block.parts)) return 'gemini_parts needs a parts list'
  if (block.type === 'tool_use') {
    if (typeof block.id !== 'string' || !TOOL_NAMES.includes(block.name) || !isObject(block.input)) return 'a tool use names an unknown tool'
  }
  if (block.type === 'text' && typeof block.text !== 'string') return 'a text block has the wrong shape'
  return null
}

// The body is { messages } and nothing else: 1 to 80 messages starting with
// the learner. Roles alternate. The last message is the learner's, except a
// paused turn, which is sent back ending on the assistant to resume it. Every
// tool use is answered in the next learner message. provider 'gemini' also
// takes gemini_parts blocks in assistant messages.
export function validateRequest(body, { provider = 'claude' } = {}) {
  if (!isObject(body) || !onlyKeys(body, ['messages'])) return fail('the body must be { messages }')
  let size
  try {
    size = JSON.stringify(body).length
  } catch {
    return fail('the body is not plain JSON')
  }
  if (size > MAX_BODY_BYTES) return fail('the body is too large')
  const { messages } = body
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) return fail('there must be 1 to 80 messages')
  let pending = null
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    const role = i % 2 === 0 ? 'user' : 'assistant'
    if (!isObject(message) || !onlyKeys(message, ['role', 'content']) || message.role !== role) return fail('roles must alternate, starting with user')
    if (!Array.isArray(message.content) || message.content.length === 0) return fail('every message needs content blocks')
    if (role === 'user') {
      for (const block of message.content) {
        const error = checkUserBlock(block)
        if (error) return fail(error)
      }
      const answered = new Set(message.content.filter((block) => block.type === 'tool_result').map((block) => block.tool_use_id))
      if (pending && !pending.every((id) => answered.has(id))) return fail('every tool use needs a tool result')
      pending = null
    } else {
      if (JSON.stringify(message.content).length > MAX_ASSISTANT_JSON) return fail('an assistant message is too long')
      for (const block of message.content) {
        const error = checkAssistantBlock(block, provider)
        if (error) return fail(error)
      }
      const ids = message.content.filter((block) => block.type === 'tool_use').map((block) => block.id)
      pending = ids.length > 0 ? ids : null
    }
  }
  const last = messages[messages.length - 1]
  if (last.role === 'assistant' && pending) return fail('the last message must be the learner')
  return { ok: true, messages }
}

// The same tools and system prompt on every request, so the prompt cache hits;
// what changes per turn lives in the messages. No thinking setting: Claude Opus
// 5.5 always thinks adaptively, and effort is the control.
export function buildApiRequest(messages) {
  return {
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    cache_control: { type: 'ephemeral' },
    system: [{ type: 'text', text: SYSTEM_PROMPT }],
    tools: TOOL_DEFINITIONS,
    messages
  }
}

// TUTOR_FAKE replies, for checks without an API key: a learner question gets
// X-ray and the strip 9 highlight, and tool results get a follow up question.
export function fakeReply(messages, nextId) {
  const last = messages[messages.length - 1]
  const results = last.role === 'user' && last.content.some((block) => block.type === 'tool_result')
  if (results) {
    return {
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Each metal bar joins five holes. Which strip holds the long leg of your LED?' }]
    }
  }
  return {
    stop_reason: 'tool_use',
    content: [
      { type: 'text', text: 'Let me show you the strips.' },
      { type: 'tool_use', id: nextId(), name: 'xray', input: { on: true } },
      { type: 'tool_use', id: nextId(), name: 'highlight', input: { target: '9-top' } }
    ]
  }
}

const TEN_MINUTES = 10 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

// Sliding windows per key (a remote address): at most perTenMinutes requests
// in any ten minutes and perDay in any day.
export function createRateLimiter({ perTenMinutes = 20, perDay = 300, now = Date.now } = {}) {
  const seen = new Map()
  function allow(key) {
    const at = now()
    const times = (seen.get(key) || []).filter((time) => at - time < DAY)
    const recent = times.filter((time) => at - time < TEN_MINUTES).length
    if (recent >= perTenMinutes || times.length >= perDay) {
      seen.set(key, times)
      return false
    }
    times.push(at)
    seen.set(key, times)
    return true
  }
  return { allow }
}
