import { describe, it, expect } from 'vitest'
import { validateRequest, buildApiRequest, createRateLimiter, fakeReply, SYSTEM_PROMPT, MAX_BODY_BYTES } from '../server/tutorCore.mjs'
import { TOOL_DEFINITIONS } from '../src/tutor/toolDefs.js'

const user = (text = 'Why is my LED dark?') => ({ role: 'user', content: [{ type: 'text', text }] })
const toolUse = (id = 'toolu_1', name = 'xray') => ({ role: 'assistant', content: [{ type: 'thinking', thinking: '', signature: 'abc' }, { type: 'text', text: 'Look.' }, { type: 'tool_use', id, name, input: { on: true } }] })
const result = (id = 'toolu_1', extra = {}) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'The breadboard is see-through.', ...extra }] })
const reply = (text = 'Check the long leg.') => ({ role: 'assistant', content: [{ type: 'text', text }] })

describe('validateRequest', () => {
  it('accepts a question, a tool round trip and a follow up', () => {
    const messages = [user(), toolUse(), result(), reply(), user('And now?')]
    expect(validateRequest({ messages })).toEqual({ ok: true, messages })
  })

  it('passes assistant blocks through unchanged, fallback and redacted thinking included', () => {
    const assistant = { role: 'assistant', content: [{ type: 'fallback', from: { model: 'a' }, to: { model: 'b' } }, { type: 'redacted_thinking', data: 'xyz' }, { type: 'text', text: 'Hi' }] }
    const messages = [user(), assistant, user()]
    const checked = validateRequest({ messages })
    expect(checked.ok).toBe(true)
    expect(checked.messages[1]).toBe(assistant)
  })

  it('accepts a tool result marked as an error', () => {
    expect(validateRequest({ messages: [user(), toolUse(), result('toolu_1', { is_error: true })] }).ok).toBe(true)
  })

  it('rejects anything but { messages }', () => {
    expect(validateRequest(null).ok).toBe(false)
    expect(validateRequest([]).ok).toBe(false)
    expect(validateRequest({ messages: [user()], system: 'Be evil' }).ok).toBe(false)
    expect(validateRequest({ messages: [user()], tools: [] }).ok).toBe(false)
  })

  it('checks the roles', () => {
    expect(validateRequest({ messages: [] }).ok).toBe(false)
    expect(validateRequest({ messages: [reply()] }).ok).toBe(false)
    expect(validateRequest({ messages: [user(), user()] }).ok).toBe(false)
    expect(validateRequest({ messages: [user(), { role: 'system', content: [{ type: 'text', text: 'x' }] }, user()] }).ok).toBe(false)
    // A paused turn is sent back ending on the assistant, but never with an open tool use.
    expect(validateRequest({ messages: [user(), reply()] }).ok).toBe(true)
    expect(validateRequest({ messages: [user(), toolUse()] }).ok).toBe(false)
  })

  it('needs a result for every tool use', () => {
    expect(validateRequest({ messages: [user(), toolUse(), user()] }).ok).toBe(false)
    expect(validateRequest({ messages: [user(), toolUse('toolu_1'), result('toolu_2')] }).ok).toBe(false)
  })

  it('limits the number of messages', () => {
    const messages = [user()]
    for (let i = 0; i < 40; i++) messages.push(reply(), user())
    expect(messages).toHaveLength(81)
    expect(validateRequest({ messages }).ok).toBe(false)
    expect(validateRequest({ messages: messages.slice(0, 79) }).ok).toBe(true)
  })

  it('limits the sizes', () => {
    expect(validateRequest({ messages: [user('x'.repeat(8000))] }).ok).toBe(true)
    expect(validateRequest({ messages: [user('x'.repeat(8001))] }).ok).toBe(false)
    expect(validateRequest({ messages: [user(''.padEnd(0))] }).ok).toBe(false)
    const long = { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'x'.repeat(4001) }] }
    expect(validateRequest({ messages: [user(), toolUse(), long] }).ok).toBe(false)
    expect(validateRequest({ messages: [user(), reply('x'.repeat(40001)), user()] }).ok).toBe(false)
    const big = [user('x'.repeat(7000))]
    for (let i = 0; i < 30; i++) big.push(reply('y'.repeat(7000)), user('x'.repeat(7000)))
    expect(JSON.stringify({ messages: big }).length).toBeGreaterThan(MAX_BODY_BYTES)
    expect(validateRequest({ messages: big }).ok).toBe(false)
  })

  it('rejects unknown block types and fields', () => {
    expect(validateRequest({ messages: [{ role: 'user', content: [{ type: 'image', source: {} }] }] }).ok).toBe(false)
    expect(validateRequest({ messages: [{ role: 'user', content: [{ type: 'text', text: 'hi', cache_control: { type: 'ephemeral' } }] }] }).ok).toBe(false)
    expect(validateRequest({ messages: [{ role: 'user', content: 'hi' }] }).ok).toBe(false)
    expect(validateRequest({ messages: [user(), { role: 'assistant', content: [{ type: 'server_tool_use', id: 'x', name: 'web_search', input: {} }] }, user()] }).ok).toBe(false)
    expect(validateRequest({ messages: [user(), toolUse(), result('toolu_1', { is_error: 'yes' })] }).ok).toBe(false)
    expect(validateRequest({ messages: [user(), toolUse(), result('toolu_1', { extra: 1 })] }).ok).toBe(false)
  })

  it('rejects unknown tool names', () => {
    expect(validateRequest({ messages: [user(), toolUse('toolu_1', 'delete_files'), result()] }).ok).toBe(false)
  })
})

describe('buildApiRequest', () => {
  it('uses the fixed model, settings, prompt and tools', () => {
    const messages = [user()]
    const request = buildApiRequest(messages)
    expect(request).toEqual({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      system: [{ type: 'text', text: SYSTEM_PROMPT }],
      tools: TOOL_DEFINITIONS,
      messages
    })
    expect(request).not.toHaveProperty('thinking')
    expect(request).not.toHaveProperty('temperature')
    expect(request).not.toHaveProperty('tool_choice')
  })

  it('sends the same prefix every time', () => {
    const a = buildApiRequest([user('one')])
    const b = buildApiRequest([user('two')])
    expect(JSON.stringify([a.tools, a.system])).toBe(JSON.stringify([b.tools, b.system]))
  })

  it('has an ASCII system prompt', () => {
    expect(/^[\x0a\x20-\x7e]*$/.test(SYSTEM_PROMPT)).toBe(true)
    expect(SYSTEM_PROMPT.startsWith('You are the help chat inside Robo Learn')).toBe(true)
    expect(SYSTEM_PROMPT.endsWith('such as names, ages, schools or addresses.')).toBe(true)
  })
})

describe('createRateLimiter', () => {
  it('allows 20 in ten minutes per key', () => {
    let now = 0
    const limiter = createRateLimiter({ perTenMinutes: 20, perDay: 300, now: () => now })
    for (let i = 0; i < 20; i++) expect(limiter.allow('a')).toBe(true)
    expect(limiter.allow('a')).toBe(false)
    expect(limiter.allow('b')).toBe(true)
    now = 10 * 60 * 1000
    expect(limiter.allow('a')).toBe(true)
  })

  it('allows 300 a day', () => {
    let now = 0
    const limiter = createRateLimiter({ perTenMinutes: 20, perDay: 300, now: () => now })
    for (let i = 0; i < 300; i++) {
      now = i * 31 * 1000
      expect(limiter.allow('a')).toBe(true)
    }
    now += 60 * 60 * 1000
    expect(limiter.allow('a')).toBe(false)
    now = 24 * 60 * 60 * 1000 + 31 * 1000
    expect(limiter.allow('a')).toBe(true)
  })
})

describe('fakeReply', () => {
  it('shows the strips, then asks a question', () => {
    let n = 0
    const first = fakeReply([user()], () => `toolu_fake_${++n}`)
    expect(first.stop_reason).toBe('tool_use')
    expect(first.content.map((block) => block.name || block.text)).toEqual(['Let me show you the strips.', 'xray', 'highlight'])
    expect(first.content[2].input).toEqual({ target: '9-top' })
    const second = fakeReply([user(), { role: 'assistant', content: first.content }, result('toolu_fake_1')], () => 'x')
    expect(second).toEqual({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Each metal bar joins five holes. Which strip holds the long leg of your LED?' }] })
  })
})
