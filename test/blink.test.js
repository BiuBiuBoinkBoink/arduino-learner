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

  // Runs the sim from startedAt 0 to endMs in 10 ms ticks, checking the goal after each tick.
  function goalAfter(values, endMs) {
    const sim = createBlinkSim({ pins: createPins(), getValues: () => values, startedAt: 0 })
    let met = false
    for (let now = 0; now <= endMs; now += 10) {
      sim.update(now)
      met = sim.checkGoal()
    }
    return met
  }

  it('goal is false before two rising edges', () => {
    expect(goalAfter({ onMs: 200, offMs: 250 }, 440)).toBe(false)
  })

  it('goal is false with 500 and 500 after many cycles', () => {
    expect(goalAfter({ onMs: 500, offMs: 500 }, 10000)).toBe(false)
  })

  it('goal is true with 200 and 250 after the second rising edge', () => {
    expect(goalAfter({ onMs: 200, offMs: 250 }, 450)).toBe(true)
  })

  it('goal is false when the values sum to 500 or more', () => {
    expect(goalAfter({ onMs: 250, offMs: 250 }, 10000)).toBe(false)
  })

  it('goal is false when the values drop under 500 but the last edges were 500 or more apart', () => {
    const pins = createPins()
    let values = { onMs: 500, offMs: 500 }
    const sim = createBlinkSim({ pins, getValues: () => values, startedAt: 0 })
    sim.update(0)
    sim.update(1000)
    values = { onMs: 200, offMs: 250 }
    expect(sim.checkGoal()).toBe(false)
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
