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

  it('reads 0.5 for a knob never set, and sets and clamps values', () => {
    const inputs = createInputs()
    expect(inputs.getValue('pot1')).toBe(0.5)
    inputs.setValue('pot1', 0.2)
    expect(inputs.getValue('pot1')).toBe(0.2)
    expect(inputs.getValue('pot2')).toBe(0.5)
    inputs.setValue('pot1', 1.4)
    expect(inputs.getValue('pot1')).toBe(1)
    inputs.setValue('pot1', -3)
    expect(inputs.getValue('pot1')).toBe(0)
  })

  it('notifies knob values as (id, value) only on a real change', () => {
    const inputs = createInputs()
    const seen = []
    inputs.subscribe((id, value) => seen.push([id, value]))
    inputs.setValue('pot1', 0.5)
    inputs.setValue('pot1', 0.7)
    inputs.setValue('pot1', 0.7)
    inputs.setValue('pot1', 2)
    inputs.setValue('pot1', 1)
    inputs.setPressed('btn1', true)
    expect(seen).toEqual([['pot1', 0.7], ['pot1', 1], ['btn1', true]])
  })

  it('stores the meter probe, null by default, without notifying', () => {
    const inputs = createInputs()
    const seen = []
    inputs.subscribe((...args) => seen.push(args))
    expect(inputs.getProbe()).toBe(null)
    inputs.setProbe('led')
    expect(inputs.getProbe()).toBe('led')
    inputs.setProbe(null)
    expect(inputs.getProbe()).toBe(null)
    expect(seen).toEqual([])
  })
})
