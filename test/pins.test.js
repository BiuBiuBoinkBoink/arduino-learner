import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'

describe('createPins', () => {
  it('reads 0 for a pin never set', () => {
    const pins = createPins()
    expect(pins.get('D13')).toBe(0)
    expect(pins.get('A0')).toBe(0)
  })

  it('sets and gets a level', () => {
    const pins = createPins()
    pins.set('D13', 1)
    expect(pins.get('D13')).toBe(1)
    pins.set('D13', 0)
    expect(pins.get('D13')).toBe(0)
  })

  it('notifies only when the level changes', () => {
    const pins = createPins()
    const calls = []
    pins.subscribe((name, level) => calls.push([name, level]))
    pins.set('D13', 0)
    pins.set('D13', 1)
    pins.set('D13', 1)
    pins.set('D13', 0)
    expect(calls).toEqual([['D13', 1], ['D13', 0]])
  })

  it('reset zeroes pins and notifies each one that changed', () => {
    const pins = createPins()
    pins.set('D13', 1)
    pins.set('D12', 1)
    pins.set('D11', 1)
    pins.set('D11', 0)
    const calls = []
    pins.subscribe((name, level) => calls.push([name, level]))
    pins.reset()
    expect(calls).toEqual([['D13', 0], ['D12', 0]])
    expect(pins.get('D13')).toBe(0)
    expect(pins.get('D12')).toBe(0)
  })

  it('unsubscribe stops notifications', () => {
    const pins = createPins()
    const calls = []
    const off = pins.subscribe((name, level) => calls.push([name, level]))
    pins.set('D13', 1)
    off()
    pins.set('D13', 0)
    expect(calls).toEqual([['D13', 1]])
  })
})
