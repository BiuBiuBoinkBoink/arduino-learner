import { describe, it, expect } from 'vitest'
import { buildGeminiRequest, toGeminiContents, fromGeminiResponse, GEMINI_TOOLS, GEMINI_MODEL } from '../server/gemini.mjs'
import { validateRequest, SYSTEM_PROMPT } from '../server/tutorCore.mjs'
import { TOOL_DEFINITIONS } from '../src/tutor/toolDefs.js'
import { createChat } from '../src/tutor/chat.js'

const STATE = '<workbench_state>\n{}\n</workbench_state>'
const user = (text) => ({ role: 'user', content: [{ type: 'text', text: STATE }, { type: 'text', text }] })
const ids = () => {
  let n = 0
  return () => ++n
}

describe('buildGeminiRequest', () => {
  it('sends the same prompt and tools as the Claude request', () => {
    const request = buildGeminiRequest([user('Hi')])
    expect(request.model).toBe(GEMINI_MODEL)
    expect(request.config.systemInstruction).toBe(SYSTEM_PROMPT)
    expect(request.config.maxOutputTokens).toBe(16000)
    expect(request.config.tools).toBe(GEMINI_TOOLS)
    const declarations = GEMINI_TOOLS[0].functionDeclarations
    expect(declarations.map((item) => item.name)).toEqual(TOOL_DEFINITIONS.map((item) => item.name))
    expect(declarations[0].parametersJsonSchema).toEqual(TOOL_DEFINITIONS[0].input_schema)
    expect(JSON.stringify(declarations)).not.toContain('strict')
    expect(request.contents).toEqual([{ role: 'user', parts: [{ text: STATE }, { text: 'Hi' }] }])
    expect(buildGeminiRequest([user('Hi')], 'gemini-other').model).toBe('gemini-other')
  })
})

describe('fromGeminiResponse', () => {
  it('turns text into an end_turn reply and keeps the raw parts', () => {
    const parts = [{ text: 'Thinking about it', thought: true }, { text: 'Which leg is longer?', thoughtSignature: 'c2ln' }]
    const reply = fromGeminiResponse({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 20, thoughtsTokenCount: 30 } }, ids())
    expect(reply).toEqual({
      stop_reason: 'end_turn',
      content: [{ type: 'gemini_parts', parts }, { type: 'text', text: 'Which leg is longer?' }],
      usage: { input_tokens: 900, output_tokens: 50, cache_read_input_tokens: 0 }
    })
  })

  it('turns function calls into tool uses, making ids where Gemini gave none', () => {
    const parts = [
      { text: 'Let me show you.' },
      { functionCall: { name: 'xray', args: { on: true } }, thoughtSignature: 'c2ln' },
      { functionCall: { id: 'fc-7', name: 'highlight', args: { target: '9-top' } } }
    ]
    const reply = fromGeminiResponse({ candidates: [{ content: { parts }, finishReason: 'STOP' }] }, ids())
    expect(reply.stop_reason).toBe('tool_use')
    expect(reply.content.slice(1)).toEqual([
      { type: 'text', text: 'Let me show you.' },
      { type: 'tool_use', id: 'gemini_call_1', name: 'xray', input: { on: true } },
      { type: 'tool_use', id: 'fc-7', name: 'highlight', input: { target: '9-top' } }
    ])
    expect(reply.content[0].parts).toBe(parts)
  })

  it('maps blocks and safety stops to a refusal, a cut to max_tokens and odd stops to failed', () => {
    expect(fromGeminiResponse({ promptFeedback: { blockReason: 'SAFETY' } }, ids()).stop_reason).toBe('refusal')
    expect(fromGeminiResponse({ candidates: [] }, ids()).stop_reason).toBe('refusal')
    expect(fromGeminiResponse({ candidates: [{ finishReason: 'PROHIBITED_CONTENT' }] }, ids())).toMatchObject({ stop_reason: 'refusal', content: [] })
    expect(fromGeminiResponse({ candidates: [{ content: { parts: [{ text: 'The LED' }] }, finishReason: 'MAX_TOKENS' }] }, ids()).stop_reason).toBe('max_tokens')
    expect(fromGeminiResponse({ candidates: [{ content: { parts: [] }, finishReason: 'MALFORMED_FUNCTION_CALL' }] }, ids())).toEqual({ error: 'failed' })
    expect(fromGeminiResponse({ candidates: [{ content: { parts: [{ text: 'x', thought: true }] }, finishReason: 'STOP' }] }, ids())).toMatchObject({ content: [], stop_reason: 'end_turn' })
  })
})

describe('toGeminiContents', () => {
  it('sends the raw model parts back unchanged and answers each call by name', () => {
    const parts = [{ text: 'Look.' }, { functionCall: { name: 'xray', args: { on: true } }, thoughtSignature: 'c2ln' }, { functionCall: { id: 'fc-7', name: 'highlight', args: { target: '9-top' } } }]
    const reply = fromGeminiResponse({ candidates: [{ content: { parts }, finishReason: 'STOP' }] }, ids())
    const messages = [
      user('Where?'),
      { role: 'assistant', content: reply.content },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'gemini_call_1', content: 'X-ray is on.' },
          { type: 'tool_result', tool_use_id: 'fc-7', content: 'No such strip.', is_error: true }
        ]
      }
    ]
    expect(validateRequest({ messages }, { provider: 'gemini' }).ok).toBe(true)
    expect(validateRequest({ messages }).ok).toBe(false)
    expect(toGeminiContents(messages).slice(1)).toEqual([
      { role: 'model', parts },
      {
        role: 'user',
        parts: [
          { functionResponse: { name: 'xray', response: { result: 'X-ray is on.' } } },
          { functionResponse: { name: 'highlight', response: { error: 'No such strip.' }, id: 'fc-7' } }
        ]
      }
    ])
  })

  it('works through the chat loop with the browser side unchanged', async () => {
    const replies = [
      fromGeminiResponse({ candidates: [{ content: { parts: [{ text: 'Look.' }, { functionCall: { name: 'xray', args: { on: true } } }] }, finishReason: 'STOP' }] }, ids()),
      fromGeminiResponse({ candidates: [{ content: { parts: [{ text: 'Which strip?' }] }, finishReason: 'STOP' }] }, ids())
    ]
    const sent = []
    const chat = createChat({
      getState: () => STATE,
      runTool: async () => ({ content: 'X-ray is on.', isError: false, chip: 'X-ray' }),
      fetchImpl: async (url, options) => {
        const body = JSON.parse(options.body)
        sent.push(body)
        expect(validateRequest(body, { provider: 'gemini' }).ok).toBe(true)
        const { content, stop_reason } = replies.shift()
        return { ok: true, status: 200, json: async () => ({ content, stop_reason }) }
      }
    })
    await chat.ask('Where does it go?')
    expect(chat.getTranscript().map((turn) => [turn.text, turn.chips])).toEqual([['Where does it go?', []], ['Look.', ['X-ray']], ['Which strip?', []]])
    expect(toGeminiContents(sent[1].messages)[2]).toEqual({ role: 'user', parts: [{ functionResponse: { name: 'xray', response: { result: 'X-ray is on.' } } }] })
  })
})
