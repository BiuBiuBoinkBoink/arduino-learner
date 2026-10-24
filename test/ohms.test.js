import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createInputs } from '../src/sim/inputs.js'
import { createOhmsSim } from '../src/sim/ohms.js'

function setup() {
  const pins = createPins()
  const inputs = createInputs()
  const values = { ohms: 220 }
  const sim = createOhmsSim({ pins, inputs, getValues: () => ({ ...values }), startedAt: 0 })
  let now = 0
  const tick = () => sim.update((now += 10))
  return { pins, inputs, values, sim, tick }
}

describe('createOhmsSim', () => {
  it('drives D9 HIGH while running and LOW on stop', () => {
    const { pins, sim, tick } = setup()
    tick()
    expect(pins.get('D9')).toBe(1)
    sim.stop()
    expect(pins.get('D9')).toBe(0)
  })

  it('reads out the probed current for the chosen resistor', () => {
    const { inputs, values, sim, tick } = setup()
    tick()
    expect(sim.readout()).toBe('Meter: pick a part to measure')
    inputs.setProbe('led')
    tick()
    expect(sim.readout()).toBe('Meter on LED: 13.6 mA')
    values.ohms = 1000
    inputs.setProbe('resistor')
    tick()
    expect(sim.readout()).toBe('Meter on Resistor: 3.0 mA')
    values.ohms = 10000
    tick()
    expect(sim.readout()).toBe('Meter on Resistor: 0.3 mA')
  })

  it('goal needs a reading with each of the three resistors', () => {
    const { inputs, values, sim, tick } = setup()
    for (const ohms of [220, 1000, 10000]) {
      values.ohms = ohms
      tick()
    }
    expect(sim.checkGoal()).toBe(false)
    inputs.setProbe('led')
    values.ohms = 220
    tick()
    values.ohms = 1000
    tick()
    expect(sim.checkGoal()).toBe(false)
    inputs.setProbe('resistor')
    values.ohms = 10000
    tick()
    expect(sim.checkGoal()).toBe(true)
  })
})
