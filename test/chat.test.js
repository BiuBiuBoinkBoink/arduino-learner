import { describe, it, expect } from 'vitest'
import { createChat, ERROR_TEXTS, REFUSAL_TEXT, CUT_SHORT, FRESH_TEXT, TOO_MANY_TOOLS, HISTORY_LIMIT } from '../src/tutor/chat.js'
import { validateRequest } from '../server/tutorCore.mjs'

const STATE = '<workbench_state>\n{"step":1}\n</workbench_state>'
const text = (value) => ({ type: 'text', text: value })
const use = (id, name = 'xray', input = { on: true }) => ({ type: 'tool_use', id, name, input })

// A fake fetch answering from a list of replies: { status, body } or a thrown error.
function fakeServer(replies) {
  const requests = []
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body)
    requests.push({ url, body: structuredClone(body) })
    const reply = replies.shift()
    if (!reply) throw new Error('no reply left')
    if (reply.throws) throw new Error('offline')
    return {
      ok: (reply.status || 200) < 400,
      status: reply.status || 200,
      json: async () => {
        if (reply.text) throw new SyntaxError('not json')
        return reply.body
      }
    }
  }
  return { fetchImpl, requests }
}

function setup(replies, runTool = async (name) => ({ content: `${name} ran`, isError: false, chip: name })) {
  const server = fakeServer(replies)
  const ran = []
  const turns = []
  const chat = createChat({
    fetchImpl: server.fetchImpl,
    getState: () => STATE,
    runTool: async (name, input, context) => {
      ran.push([name, input])
      turns.push(context.turn)
      return runTool(name, input)
    }
  })
  return { chat, ran, turns, requests: server.requests }
}

describe('createChat', () => {
  it('sends a learner turn with the state block, then shows a plain answer', async () => {
    const { chat, requests } = setup([{ body: { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '', signature: 's' }, text('Which leg is longer?')] } }])
    const seen = []
    chat.subscribe(() => seen.push(chat.isBusy()))
    await chat.ask('  Why is my LED dark?  ')
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('/api/tutor')
    expect(requests[0].body).toEqual({ messages: [{ role: 'user', content: [text(STATE), text('Why is my LED dark?')] }] })
    expect(chat.getTranscript()).toEqual([
      { role: 'learner', text: 'Why is my LED dark?', chips: [], cards: [], muted: false, note: '' },
      { role: 'helper', text: 'Which leg is longer?', chips: [], cards: [], muted: false, note: '' }
    ])
    expect(seen[0]).toBe(true)
    expect(chat.isBusy()).toBe(false)
    // The assistant blocks are kept exactly as returned, thinking included.
    expect(chat.getMessages()[1].content[0]).toEqual({ type: 'thinking', thinking: '', signature: 's' })
  })

  it('runs tools, sends their results without a state block and shows chips', async () => {
    const { chat, ran, requests } = setup([
      { body: { stop_reason: 'tool_use', content: [text('Let me show you the strips.'), use('t1'), use('t2', 'highlight', { target: '9-top' })] } },
      { body: { stop_reason: 'end_turn', content: [text('Which strip holds the long leg?')] } }
    ])
    await chat.ask('Where does it go?')
    expect(ran).toEqual([['xray', { on: true }], ['highlight', { target: '9-top' }]])
    const second = requests[1].body.messages
    expect(second).toHaveLength(3)
    expect(second[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 't1', content: 'xray ran' },
        { type: 'tool_result', tool_use_id: 't2', content: 'highlight ran' }
      ]
    })
    expect(JSON.stringify(second[2])).not.toContain('workbench_state')
    const transcript = chat.getTranscript()
    expect(transcript.map((entry) => [entry.role, entry.text, entry.chips])).toEqual([
      ['learner', 'Where does it go?', []],
      ['helper', 'Let me show you the strips.', ['xray', 'highlight']],
      ['helper', 'Which strip holds the long leg?', []]
    ])
    // Every request is one the server accepts.
    for (const request of requests) expect(validateRequest(request.body).ok).toBe(true)
  })

  it('gives every tool call of one question the same turn, and the next question a new one', async () => {
    const { chat, turns } = setup([
      { body: { stop_reason: 'tool_use', content: [use('t1', 'next_hint', {})] } },
      { body: { stop_reason: 'tool_use', content: [use('t2', 'show_placement', { part: 'r1' })] } },
      { body: { stop_reason: 'end_turn', content: [text('Try the hint.')] } },
      { body: { stop_reason: 'tool_use', content: [use('t3', 'show_placement', { part: 'r1' })] } },
      { body: { stop_reason: 'end_turn', content: [text('There it is.')] } }
    ])
    await chat.ask('Where does it go?')
    await chat.ask('Still stuck')
    expect(turns).toHaveLength(3)
    expect(turns[0]).toBe(turns[1])
    expect(turns[2]).not.toBe(turns[0])
  })

  it('runs four tools and answers a fifth with an error', async () => {
    const uses = ['a', 'b', 'c', 'd', 'e'].map((id) => use(id, 'measure', { target: '9e' }))
    const { chat, ran, requests } = setup([
      { body: { stop_reason: 'tool_use', content: uses } },
      { body: { stop_reason: 'end_turn', content: [text('Done.')] } }
    ])
    await chat.ask('Measure everything')
    expect(ran).toHaveLength(4)
    const results = requests[1].body.messages[2].content
    expect(results).toHaveLength(5)
    expect(results[4]).toEqual({ type: 'tool_result', tool_use_id: 'e', content: TOO_MANY_TOOLS, is_error: true })
    expect(results.slice(0, 4).every((block) => block.is_error === undefined)).toBe(true)
  })

  it('marks failed tools as errors and keeps their cards', async () => {
    const card = { kind: 'quiz', question: 'q', options: ['a', 'b'], answer: 0, why: 'w' }
    const runTool = async (name) => (name === 'quick_check' ? { content: 'Shown.', isError: false, chip: 'Quick check', card } : { content: 'Bad input.', isError: true })
    const { chat, requests } = setup([
      { body: { stop_reason: 'tool_use', content: [use('q1', 'quick_check', {}), use('x1', 'xray', {})] } },
      { body: { stop_reason: 'end_turn', content: [text('Try it.')] } }
    ], runTool)
    await chat.ask('Quiz me')
    expect(requests[1].body.messages[2].content[1]).toEqual({ type: 'tool_result', tool_use_id: 'x1', content: 'Bad input.', is_error: true })
    expect(chat.getTranscript()[1].cards).toEqual([card])
    expect(chat.getTranscript()[1].chips).toEqual(['Quick check'])
  })

  it('shows a refusal and takes the question back out of the history', async () => {
    const { chat, requests } = setup([
      { body: { stop_reason: 'refusal', content: [] } },
      { body: { stop_reason: 'end_turn', content: [text('The anode.')] } }
    ])
    await chat.ask('Something off topic')
    expect(chat.getTranscript().at(-1).text).toBe(REFUSAL_TEXT)
    expect(chat.getMessages()).toEqual([])
    await chat.ask('Which leg is long?')
    expect(requests[1].body.messages).toHaveLength(1)
  })

  it('notes an answer cut short', async () => {
    const { chat } = setup([{ body: { stop_reason: 'max_tokens', content: [text('The LED needs')] } }])
    await chat.ask('Explain')
    expect(chat.getTranscript().at(-1).note).toBe(CUT_SHORT)
  })

  it('goes on after a paused turn without adding a message', async () => {
    const { chat, requests } = setup([
      { body: { stop_reason: 'pause_turn', content: [text('Thinking it over.')] } },
      { body: { stop_reason: 'end_turn', content: [text('Done.')] } }
    ])
    await chat.ask('Hi')
    expect(requests[1].body.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(validateRequest(requests[1].body).ok).toBe(true)
  })

  it.each([
    [{ status: 500, body: { error: 'not_configured' } }, 'not_configured'],
    [{ status: 429, body: { error: 'rate_limited' } }, 'rate_limited'],
    [{ status: 503, body: { error: 'busy' } }, 'busy'],
    [{ status: 502, body: { error: 'failed' } }, 'failed'],
    [{ status: 400, body: { error: 'bad_request' } }, 'failed'],
    [{ status: 502, text: true }, 'network'],
    [{ throws: true }, 'network'],
    [{ status: 200, body: { nothing: true } }, 'failed']
  ])('shows each HTTP error as a muted helper turn (%o)', async (reply, kind) => {
    const { chat } = setup([reply])
    await chat.ask('Hello')
    const last = chat.getTranscript().at(-1)
    expect(last).toMatchObject({ role: 'helper', text: ERROR_TEXTS[kind], muted: true })
    expect(chat.getMessages()).toEqual([])
    expect(chat.isBusy()).toBe(false)
  })

  it('maps the errors to the Ask tab texts', () => {
    expect(ERROR_TEXTS.not_configured).toBe('The help chat is not available right now.')
    expect(ERROR_TEXTS.network).toBe('The help chat is not available right now.')
    expect(ERROR_TEXTS.rate_limited).toBe('You have asked a lot of questions. Try again in a few minutes.')
    expect(ERROR_TEXTS.busy).toBe('The helper is busy. Try again in a moment.')
    expect(ERROR_TEXTS.failed).toBe('Something went wrong. Try asking again.')
  })

  it('takes back a tool round when a later request fails', async () => {
    const { chat } = setup([
      { body: { stop_reason: 'tool_use', content: [use('t1')] } },
      { status: 503, body: { error: 'busy' } }
    ])
    await chat.ask('Show me')
    expect(chat.getMessages()).toEqual([])
    expect(chat.getTranscript().at(-1).text).toBe(ERROR_TEXTS.busy)
  })

  it('stops after six requests and sends the question with the unsent results', async () => {
    const replies = Array.from({ length: 6 }, (_, i) => ({ body: { stop_reason: 'tool_use', content: [use('t' + i)] } }))
    replies.push({ body: { stop_reason: 'end_turn', content: [text('OK.')] } })
    const { chat, requests } = setup(replies)
    await chat.ask('Keep going')
    expect(requests).toHaveLength(6)
    expect(chat.getMessages().at(-1).role).toBe('user')
    await chat.ask('And now?')
    const last = requests[6].body.messages.at(-1)
    expect(last.content.map((block) => block.type)).toEqual(['tool_result', 'text', 'text'])
    expect(validateRequest(requests[6].body).ok).toBe(true)
  })

  it('starts fresh once the history passes 60 messages', async () => {
    const replies = []
    for (let i = 0; i < 31; i++) replies.push({ body: { stop_reason: 'end_turn', content: [text('Answer ' + i)] } })
    const { chat, requests } = setup(replies)
    for (let i = 0; i < 31; i++) await chat.ask('Question ' + i)
    expect(requests[29].body.messages).toHaveLength(59)
    expect(requests[30].body.messages).toHaveLength(61)
    expect(chat.getMessages()).toHaveLength(62)
    expect(HISTORY_LIMIT).toBe(60)
    // The next question starts a new conversation.
    replies.push({ body: { stop_reason: 'end_turn', content: [text('Fresh.')] } })
    await chat.ask('One more')
    expect(requests.at(-1).body.messages).toHaveLength(1)
    const transcript = chat.getTranscript()
    expect(transcript.at(-3)).toMatchObject({ role: 'helper', text: FRESH_TEXT, muted: true })
  })

  it('reset empties the chat and drops a late answer', async () => {
    let release
    const fetchImpl = () => new Promise((resolve) => {
      release = () => resolve({ ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [text('Late.')] }) })
    })
    const chat = createChat({ fetchImpl, getState: () => STATE, runTool: async () => ({ content: '', isError: false }) })
    const pending = chat.ask('Hello')
    expect(chat.isBusy()).toBe(true)
    chat.reset()
    expect(chat.getTranscript()).toEqual([])
    expect(chat.isBusy()).toBe(false)
    release()
    await pending
    expect(chat.getTranscript()).toEqual([])
    expect(chat.getMessages()).toEqual([])
  })

  it('ignores empty questions and a question while busy', async () => {
    const { chat, requests } = setup([{ body: { stop_reason: 'end_turn', content: [text('Hi.')] } }])
    await chat.ask('   ')
    expect(requests).toHaveLength(0)
    const first = chat.ask('One')
    await chat.ask('Two')
    await first
    expect(requests).toHaveLength(1)
  })

  it('keeps nothing in localStorage', () => {
    expect(String(createChat)).not.toContain('localStorage')
  })
})
