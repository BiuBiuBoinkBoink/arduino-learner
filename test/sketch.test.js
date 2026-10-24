import { describe, it, expect } from 'vitest'
import { defaultValues, fillSketch, slotValues, stepDuration, traceStepAt } from '../src/ui/sketch.js'

describe('defaultValues', () => {
  it('maps each param name to its default value', () => {
    const params = [
      { name: 'onMs', type: 'range', min: 100, max: 1000, step: 50, value: 500 },
      { name: 'ohms', type: 'choice', value: 220, options: [{ value: 220, label: '220 ohm' }] }
    ]
    expect(defaultValues(params)).toEqual({ onMs: 500, ohms: 220 })
    expect(defaultValues([])).toEqual({})
  })
})

describe('slotValues', () => {
  it('uses the chosen option code text and keeps other values', () => {
    const params = [
      { name: 'pull', type: 'choice', value: 'down', options: [{ value: 'down', label: 'Fitted', code: 'pulled down' }, { value: 'none', label: 'Removed' }] },
      { name: 'ms', type: 'range', min: 0, max: 10, step: 1, value: 5 }
    ]
    expect(slotValues(params, { pull: 'down', ms: 5 })).toEqual({ pull: 'pulled down', ms: 5 })
    expect(slotValues(params, { pull: 'none', ms: 3 })).toEqual({ pull: 'none', ms: 3 })
  })
})

describe('fillSketch', () => {
  it('replaces every slot with its value', () => {
    expect(fillSketch('delay({{a}}); delay({{b}}); x = {{a}};', { a: 200, b: 'z' }))
      .toBe('delay(200); delay(z); x = 200;')
  })

  it('leaves slots with no value unchanged', () => {
    expect(fillSketch('delay({{a}}); delay({{missing}});', { a: 5 }))
      .toBe('delay(5); delay({{missing}});')
  })
})

describe('stepDuration', () => {
  it('returns a numeric ms as is', () => {
    expect(stepDuration({ line: 1, ms: 150 }, { onMs: 900 })).toBe(150)
  })

  it('looks up a string ms in the values', () => {
    expect(stepDuration({ line: 2, ms: 'onMs' }, { onMs: 900 })).toBe(900)
  })
})

describe('traceStepAt', () => {
  const trace = [
    { line: 9, ms: 100 },
    { line: 10, ms: 'onMs' },
    { line: 11, ms: 100 },
    { line: 12, ms: 'offMs' }
  ]
  const values = { onMs: 500, offMs: 300 }

  it('returns the step active at a time inside it', () => {
    expect(traceStepAt(trace, values, 0)).toBe(0)
    expect(traceStepAt(trace, values, 50)).toBe(0)
    expect(traceStepAt(trace, values, 300)).toBe(1)
    expect(traceStepAt(trace, values, 650)).toBe(2)
    expect(traceStepAt(trace, values, 900)).toBe(3)
  })

  it('moves to the next step exactly at a boundary', () => {
    expect(traceStepAt(trace, values, 99)).toBe(0)
    expect(traceStepAt(trace, values, 100)).toBe(1)
    expect(traceStepAt(trace, values, 600)).toBe(2)
    expect(traceStepAt(trace, values, 700)).toBe(3)
    expect(traceStepAt(trace, values, 999)).toBe(3)
  })

  it('loops after one full pass', () => {
    expect(traceStepAt(trace, values, 1000)).toBe(0)
    expect(traceStepAt(trace, values, 1100)).toBe(1)
    expect(traceStepAt(trace, values, 2650)).toBe(2)
  })

  it('uses the current param values', () => {
    expect(traceStepAt(trace, { onMs: 100, offMs: 300 }, 250)).toBe(2)
  })

  it('returns -1 for an empty trace', () => {
    expect(traceStepAt([], values, 0)).toBe(-1)
    expect(traceStepAt([], values, 500)).toBe(-1)
  })
})
