// Gemini for the tutor server (TUTOR_PROVIDER=gemini): pure translation
// between the chat's messages (the Claude message shape the browser keeps)
// and Gemini's generateContent contents, so the browser, the checks and the
// tools stay the same. Unit tested; server/tutor.mjs makes the call.
//
// A model turn comes back as [{ type: 'gemini_parts', parts }, ...text blocks,
// ...tool_use blocks]: the raw parts go back to Gemini unchanged on later
// requests (their thought signatures must), the text and tool_use blocks are
// what the chat reads. A function call without an id gets one made here
// (gemini_call_N), and its function response is sent without it.
//
// buildGeminiRequest(messages, model) -> generateContent params
// toGeminiContents(messages) -> Content[]
// fromGeminiResponse(response, nextId) -> { content, stop_reason, usage } | { error: 'failed' }
import { SYSTEM_PROMPT } from './tutorCore.mjs'
import { TOOL_DEFINITIONS } from '../src/tutor/toolDefs.js'

export const GEMINI_MODEL = 'gemini-flash-latest'
export const MADE_ID = 'gemini_call_'
const REFUSED = ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT', 'IMAGE_RECITATION']

// The tool list in Gemini's form: the same names, descriptions and schemas.
export const GEMINI_TOOLS = [{
  functionDeclarations: TOOL_DEFINITIONS.map((definition) => ({
    name: definition.name,
    description: definition.description,
    parametersJsonSchema: definition.input_schema
  }))
}]

export function toGeminiContents(messages) {
  // Tool names by tool_use id, for the function responses.
  const names = new Map()
  return messages.map((message) => {
    if (message.role === 'assistant') {
      const raw = message.content.find((block) => block.type === 'gemini_parts')
      for (const block of message.content) if (block.type === 'tool_use') names.set(block.id, block.name)
      if (raw) return { role: 'model', parts: raw.parts }
      return {
        role: 'model',
        parts: message.content.flatMap((block) => {
          if (block.type === 'text') return [{ text: block.text }]
          if (block.type === 'tool_use') return [{ functionCall: { id: block.id, name: block.name, args: block.input } }]
          return []
        })
      }
    }
    return {
      role: 'user',
      parts: message.content.map((block) => {
        if (block.type === 'text') return { text: block.text }
        const response = { name: names.get(block.tool_use_id), response: block.is_error ? { error: block.content } : { result: block.content } }
        if (!block.tool_use_id.startsWith(MADE_ID)) response.id = block.tool_use_id
        return { functionResponse: response }
      })
    }
  })
}

export function buildGeminiRequest(messages, model = GEMINI_MODEL) {
  return {
    model,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: GEMINI_TOOLS,
      maxOutputTokens: 16000
    }
  }
}

export function fromGeminiResponse(response, nextId) {
  const usageOf = (meta = {}) => ({
    input_tokens: meta.promptTokenCount || 0,
    output_tokens: (meta.candidatesTokenCount || 0) + (meta.thoughtsTokenCount || 0),
    cache_read_input_tokens: meta.cachedContentTokenCount || 0
  })
  const usage = usageOf(response && response.usageMetadata)
  const candidate = response && response.candidates && response.candidates[0]
  if (!candidate || (response.promptFeedback && response.promptFeedback.blockReason)) return { content: [], stop_reason: 'refusal', usage }
  const reason = candidate.finishReason || 'STOP'
  if (REFUSED.includes(reason)) return { content: [], stop_reason: 'refusal', usage }
  if (!['STOP', 'MAX_TOKENS', 'FINISH_REASON_UNSPECIFIED'].includes(reason)) return { error: 'failed' }
  const parts = (candidate.content && candidate.content.parts) || []
  const texts = []
  const uses = []
  for (const part of parts) {
    if (part.functionCall) {
      const call = part.functionCall
      uses.push({ type: 'tool_use', id: call.id || MADE_ID + nextId(), name: call.name, input: call.args || {} })
    } else if (typeof part.text === 'string' && !part.thought && part.text.trim()) {
      texts.push({ type: 'text', text: part.text })
    }
  }
  if (texts.length + uses.length === 0) return { content: [], stop_reason: 'end_turn', usage }
  const stop = uses.length > 0 ? 'tool_use' : reason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn'
  return { content: [{ type: 'gemini_parts', parts }, ...texts, ...uses], stop_reason: stop, usage }
}
