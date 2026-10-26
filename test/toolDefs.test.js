import { describe, it, expect } from 'vitest'
import { TOOL_DEFINITIONS, TOOL_NAMES } from '../src/tutor/toolDefs.js'
import { createTutorTools } from '../src/tutor/tools.js'

describe('tutor tool definitions', () => {
  it('has unique snake case names', () => {
    expect(new Set(TOOL_NAMES).size).toBe(TOOL_NAMES.length)
    for (const name of TOOL_NAMES) expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/)
    expect(TOOL_NAMES).toHaveLength(20)
  })

  it('makes every schema strict shaped', () => {
    for (const definition of TOOL_DEFINITIONS) {
      expect(definition.strict).toBe(true)
      expect(typeof definition.description).toBe('string')
      const schema = definition.input_schema
      expect(schema.type).toBe('object')
      expect(schema.additionalProperties).toBe(false)
      expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort())
    }
  })

  it('uses no keywords strict mode rejects', () => {
    const banned = ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern']
    const json = JSON.stringify(TOOL_DEFINITIONS)
    for (const word of banned) expect(json).not.toContain(`"${word}"`)
  })

  it('has a handler for every name', () => {
    const tools = createTutorTools({})
    for (const name of TOOL_NAMES) expect(tools.has(name)).toBe(true)
    expect(tools.has('delete_everything')).toBe(false)
  })

  it('is ASCII only', () => {
    expect(/^[\x20-\x7e]*$/.test(JSON.stringify(TOOL_DEFINITIONS))).toBe(true)
  })
})
