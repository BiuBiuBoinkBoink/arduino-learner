import { describe, it, expect } from 'vitest'
import { createInputs } from '../src/sim/inputs.js'

describe('createInputs', () => {
  it('reads false for any id by default', () => {
    const inputs = createInputs()
    expect(inputs.isPressed('btn1')).toBe(false)
  })

  it('sets and gets each id on its own', () => {
    const inputs = createInputs()
    inputs.setPressed('btn1', true)
    expect(inputs.isPressed('btn1')).toBe(true)
    expect(inputs.isPressed('btn2')).toBe(false)
    inputs.setPressed('btn1', false)
    expect(inputs.isPressed('btn1')).toBe(false)
  })

  it('notifies subscribers only on a real change, until unsubscribed', () => {
    const inputs = createInputs()
    const seen = []
    const unsubscribe = inputs.subscribe((id, on) => seen.push([id, on]))
    inputs.setPressed('btn1', false)
    inputs.setPressed('btn1', true)
    inputs.setPressed('btn1', true)
    inputs.setPressed('btn1', false)
    unsubscribe()
    inputs.setPressed('btn1', true)
    expect(seen).toEqual([['btn1', true], ['btn1', false]])
  })
})
