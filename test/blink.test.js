import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createBlinkSim } from '../src/sim/blink.js'

describe('createBlinkSim', () => {
  it('drives D13 high for onMs then low for offMs from startedAt', () => {
    const pins = createPins()
    const sim = createBlinkSim({ pins, getValues: () => ({ onMs: 300, offMs: 200 }), startedAt: 1000 })
    const levels = [1000, 1299, 1300, 1499, 1500].map((now) => {
      sim.update(now)
      return pins.get('D13')
    })
    expect(levels).toEqual([1, 1, 0, 0, 1])
  })

  it('has no goal check', () => {
    const sim = createBlinkSim({ pins: createPins(), getValues: () => ({ onMs: 300, offMs: 200 }), startedAt: 0 })
    expect(sim.checkGoal).toBeUndefined()
  })

  it('stop leaves D13 low', () => {
    const pins = createPins()
    const sim = createBlinkSim({ pins, getValues: () => ({ onMs: 300, offMs: 200 }), startedAt: 1000 })
    sim.update(1100)
    expect(pins.get('D13')).toBe(1)
    sim.stop()
    expect(pins.get('D13')).toBe(0)
  })

  it('reads the values live', () => {
    const pins = createPins()
    let values = { onMs: 300, offMs: 200 }
    const sim = createBlinkSim({ pins, getValues: () => values, startedAt: 1000 })
    sim.update(1350)
    expect(pins.get('D13')).toBe(0)
    values = { onMs: 400, offMs: 200 }
    sim.update(1350)
    expect(pins.get('D13')).toBe(1)
  })
})
