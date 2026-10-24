import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createRgbSim, TARGET, TOLERANCE } from '../src/sim/rgb.js'

function setup(start = { red: 0, green: 120, blue: 255 }) {
  const pins = createPins()
  const values = { ...start }
  const sim = createRgbSim({ pins, getValues: () => ({ ...values }), startedAt: 0 })
  let now = 0
  const tick = () => sim.update((now += 10))
  return { pins, values, sim, tick }
}

describe('createRgbSim', () => {
  it('sets D9, D10 and D11 to each channel / 255, and stop clears them', () => {
    const { pins, sim, tick } = setup({ red: 255, green: 51, blue: 0 })
    tick()
    expect(pins.get('D9')).toBe(1)
    expect(pins.get('D10')).toBeCloseTo(0.2, 6)
    expect(pins.get('D11')).toBe(0)
    sim.stop()
    expect([pins.get('D9'), pins.get('D10'), pins.get('D11')]).toEqual([0, 0, 0])
  })

  it('reads out the current mix and the target', () => {
    const { sim, tick } = setup()
    tick()
    expect(sim.readout()).toBe('Now 0, 120, 255. Target orange 255, 128, 0')
  })

  it('targets orange within 25 per channel', () => {
    expect(TARGET).toEqual({ name: 'orange', red: 255, green: 128, blue: 0 })
    expect(TOLERANCE).toBe(25)
  })

  it('goal is false at the default mix and true once every channel is within tolerance', () => {
    const { values, sim, tick } = setup()
    tick()
    expect(sim.checkGoal()).toBe(false)
    Object.assign(values, { red: 255, green: 128, blue: 30 })
    tick()
    expect(sim.checkGoal()).toBe(false)
    Object.assign(values, { red: 235, green: 150, blue: 20 })
    tick()
    expect(sim.checkGoal()).toBe(true)
    Object.assign(values, { red: 0, green: 0, blue: 0 })
    tick()
    expect(sim.checkGoal()).toBe(true)
  })
})
