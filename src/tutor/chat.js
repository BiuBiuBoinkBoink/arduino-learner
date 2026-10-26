// Help chat loop: the conversation with the tutor server, held in memory only
// (never in localStorage), one conversation per lesson (main.js calls reset()
// on a lesson change). A learner turn is the state block plus the question;
// tool result turns carry no state block. The history is append only: earlier
// messages are never edited, so the model's thinking stays valid. A failed
// request takes back what this question added, so the history stays valid.
//
// createChat({ endpoint, fetchImpl, runTool, getState }) -> { ask(text),
//   reset(), getTranscript(), isBusy(), subscribe(fn) }
// runTool(name, input) -> { content, isError, chip?, card? }; getState() -> the
// state block text. getTranscript() -> [{ role: 'learner' | 'helper', text,
// chips, cards, muted, note }]: what the Ask tab shows.

export const ERROR_TEXTS = {
  not_configured: 'The help chat is not available right now.',
  network: 'The help chat is not available right now.',
  rate_limited: 'You have asked a lot of questions. Try again in a few minutes.',
  busy: 'The helper is busy. Try again in a moment.',
  failed: 'Something went wrong. Try asking again.'
}
export const REFUSAL_TEXT = 'I cannot help with that. Ask me about your circuit, your code or this step.'
export const CUT_SHORT = '(This answer was cut short.)'
export const FRESH_TEXT = 'This chat got long, so it started fresh.'
export const TOO_MANY_TOOLS = 'Too many tools in one reply.'
export const MAX_REQUESTS = 6
export const MAX_TOOLS = 4
export const HISTORY_LIMIT = 60
export const MAX_QUESTION = 500
const MAX_RESULT = 4000
const SERVER_ERRORS = ['not_configured', 'rate_limited', 'busy', 'failed']

export function createChat({ endpoint = '/api/tutor', fetchImpl = (...args) => fetch(...args), runTool, getState }) {
  let messages = []
  let transcript = []
  let busy = false
  // Bumped by reset(), so an answer to an old conversation is dropped.
  let generation = 0
  const listeners = new Set()

  function notify() {
    listeners.forEach((fn) => fn())
  }

  const turn = (role, text, extra = {}) => ({ role, text, chips: [], cards: [], muted: false, note: '', ...extra })

  // { body } or { error }: a reply the server could not give, or no server
  // (a proxy error page without our JSON) is 'network'.
  async function post() {
    let response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages })
      })
    } catch {
      return { error: 'network' }
    }
    let body = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    if (!response.ok) {
      if (body && SERVER_ERRORS.includes(body.error)) return { error: body.error }
      return { error: response.status >= 500 ? 'network' : 'failed' }
    }
    if (!body || !Array.isArray(body.content) || typeof body.stop_reason !== 'string') return { error: 'failed' }
    return { body }
  }

  async function runTools(uses, helper) {
    const results = []
    for (const [index, use] of uses.entries()) {
      if (index >= MAX_TOOLS) {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: TOO_MANY_TOOLS, is_error: true })
        continue
      }
      let result
      try {
        result = await runTool(use.name, use.input)
      } catch {
        result = { content: `${use.name} did not work right now.`, isError: true }
      }
      if (result.chip) helper.chips.push(result.chip)
      if (result.card) helper.cards.push(result.card)
      const block = { type: 'tool_result', tool_use_id: use.id, content: String(result.content || '').slice(0, MAX_RESULT) }
      if (result.isError) block.is_error = true
      results.push(block)
    }
    return results
  }

  async function ask(text) {
    const question = String(text || '').trim().slice(0, MAX_QUESTION)
    if (!question || busy) return
    const gen = generation
    if (messages.length > HISTORY_LIMIT) {
      messages = []
      transcript.push(turn('helper', FRESH_TEXT, { muted: true }))
    }
    transcript.push(turn('learner', question))
    const blocks = [{ type: 'text', text: getState() }, { type: 'text', text: question }]
    // Tool results left unsent (the request limit) take the question with them.
    const start = messages.length
    const last = messages[start - 1]
    const merged = last && last.role === 'user' ? last.content : null
    if (merged) messages[start - 1] = { role: 'user', content: [...merged, ...blocks] }
    else messages.push({ role: 'user', content: blocks })

    function takeBack() {
      messages.length = start
      if (merged) messages[start - 1] = { role: 'user', content: merged }
    }

    busy = true
    notify()
    try {
      for (let request = 0; request < MAX_REQUESTS; request++) {
        const reply = await post()
        if (gen !== generation) return
        if (reply.error) {
          takeBack()
          transcript.push(turn('helper', ERROR_TEXTS[reply.error], { muted: true, error: reply.error }))
          return
        }
        const { content, stop_reason: stop } = reply.body
        if (stop === 'refusal' || content.length === 0) {
          takeBack()
          if (stop === 'refusal') transcript.push(turn('helper', REFUSAL_TEXT))
          return
        }
        messages.push({ role: 'assistant', content })
        const helper = turn('helper', content.filter((block) => block.type === 'text').map((block) => block.text).join('\n\n').trim())
        transcript.push(helper)
        if (stop === 'tool_use') {
          const uses = content.filter((block) => block.type === 'tool_use')
          if (uses.length === 0) return
          notify()
          const results = await runTools(uses, helper)
          if (gen !== generation) return
          messages.push({ role: 'user', content: results })
          notify()
          continue
        }
        if (stop === 'pause_turn') continue
        if (stop === 'max_tokens') helper.note = CUT_SHORT
        return
      }
    } finally {
      if (gen === generation) {
        busy = false
        notify()
      }
    }
  }

  function reset() {
    generation += 1
    messages = []
    transcript = []
    busy = false
    notify()
  }

  return {
    ask,
    reset,
    getTranscript: () => transcript.map((entry) => ({ ...entry, chips: entry.chips.slice(), cards: entry.cards.slice() })),
    isBusy: () => busy,
    // For tests and checks: the API messages as they would be sent next.
    getMessages: () => messages.slice(),
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    }
  }
}
