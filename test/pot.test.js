import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createInputs } from '../src/sim/inputs.js'
import { createPotSim } from '../src/sim/pot.js'
import { createSerial } from '../src/sim/serial.js'

function setup(inputs = createInputs()) {
  const pins = createPins()
  const sim = createPotSim({ pins, inputs, getValues: () => ({}), startedAt: 0 })
  let now = 0
  const tick = () => sim.update((now += 10))
  // Turn the knob to v and let one update see it.
  const turn = (v) => {
    inputs.setValue('pot1', v)
    tick()
  }
  return { pins, inputs, sim, tick, turn }
}

describe('createPotSim', () => {
  it('sets A0 to the knob value', () => {
    const { pins, tick, turn } = setup()
    tick()
    expect(pins.get('A0')).toBe(0.5)
    turn(0.2)
    expect(pins.get('A0')).toBe(0.2)
    turn(1)
    expect(pins.get('A0')).toBe(1)
  })

  it('reads out the raw value and volts', () => {
    const { sim, tick, turn } = setup()
    tick()
    expect(sim.readout()).toBe('A0 reads 512, 2.50 V')
    turn(0)
    expect(sim.readout()).toBe('A0 reads 0, 0.00 V')
    turn(1)
    expect(sim.readout()).toBe('A0 reads 1023, 5.00 V')
  })

  it('stop sets A0 to 0', () => {
    const { pins, sim, turn } = setup()
    turn(0.8)
    sim.stop()
    expect(pins.get('A0')).toBe(0)
  })

  it('goal is false after only one end and true after both, in either order', () => {
    const low = setup()
    low.tick()
    low.turn(0.05)
    expect(low.sim.checkGoal()).toBe(false)
    low.turn(0.95)
    expect(low.sim.checkGoal()).toBe(true)

    const high = setup()
    high.turn(1)
    expect(high.sim.checkGoal()).toBe(false)
    high.turn(0.5)
    high.turn(0)
    expect(high.sim.checkGoal()).toBe(true)
  })

  it('does not count ends reached before Run', () => {
    const inputs = createInputs()
    inputs.setValue('pot1', 0)
    inputs.setValue('pot1', 1)
    inputs.setValue('pot1', 0.5)
    const { sim, tick, turn } = setup(inputs)
    tick()
    expect(sim.checkGoal()).toBe(false)
    turn(1)
    expect(sim.checkGoal()).toBe(false)
  })

  it('prints the volts to Serial every 200 ms, like the sketch', () => {
    const pins = createPins()
    const inputs = createInputs()
    const serial = createSerial()
    const sim = createPotSim({ pins, inputs, serial, getValues: () => ({}), startedAt: 100 })
    sim.update(100)
    sim.update(250)
    expect(serial.getLines()).toEqual(['2.50'])
    inputs.setValue('pot1', 1)
    sim.update(300)
    sim.update(500)
    expect(serial.getLines()).toEqual(['2.50', '5.00', '5.00'])
  })
})
