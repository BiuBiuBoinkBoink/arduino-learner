import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createFadeSim } from '../src/sim/fade.js'

function setup(stepMs) {
  const pins = createPins()
  const values = { stepMs }
  const sim = createFadeSim({ pins, getValues: () => ({ ...values }), startedAt: 0 })
  // Ticks every 16 ms, like animation frames, until now reaches until.
  let now = 0
  function runUntil(until) {
    while (now < until) sim.update((now = Math.min(until, now + 16)))
  }
  return { pins, values, sim, runUntil }
}

describe('createFadeSim', () => {
  it('raises D9 one step every stepMs, then lowers it', () => {
    const { pins, runUntil } = setup(10)
    runUntil(0)
    expect(pins.get('D9')).toBe(0)
    runUntil(1000)
    expect(pins.get('D9')).toBeCloseTo(100 / 255, 6)
    runUntil(2550)
    expect(pins.get('D9')).toBe(1)
    // Index 256 holds 255 again, the second loop then counts down.
    runUntil(3560)
    expect(pins.get('D9')).toBeCloseTo(155 / 255, 6)
    runUntil(5110)
    expect(pins.get('D9')).toBe(0)
  })

  it('picks up a live stepMs change', () => {
    const { pins, values, runUntil } = setup(10)
    runUntil(500)
    expect(pins.get('D9')).toBeCloseTo(50 / 255, 6)
    values.stepMs = 2
    runUntil(700)
    expect(pins.get('D9')).toBeCloseTo(150 / 255, 6)
  })

  it('goal never passes at the default 10 ms', () => {
    const { sim, runUntil } = setup(10)
    runUntil(30000)
    expect(sim.checkGoal()).toBe(false)
  })

  it('goal passes at 3 ms after one full fade, not before', () => {
    const { sim, runUntil } = setup(3)
    runUntil(1400)
    expect(sim.checkGoal()).toBe(false)
    runUntil(1600)
    expect(sim.checkGoal()).toBe(true)
  })

  it('goal needs the current stepMs in range too', () => {
    const { sim, values, runUntil } = setup(3)
    runUntil(1600)
    values.stepMs = 10
    expect(sim.checkGoal()).toBe(false)
  })

  it('reads out the analogWrite value and duty, and stop turns D9 off', () => {
    const { pins, sim, runUntil } = setup(10)
    runUntil(0)
    expect(sim.readout()).toBe('analogWrite(9, 0), duty 0%')
    runUntil(1280)
    expect(sim.readout()).toBe('analogWrite(9, 128), duty 50%')
    sim.stop()
    expect(pins.get('D9')).toBe(0)
  })
})
