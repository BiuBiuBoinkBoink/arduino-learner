import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createInputs } from '../src/sim/inputs.js'
import { createButtonSim } from '../src/sim/button.js'

function setup() {
  const pins = createPins()
  const inputs = createInputs()
  const sim = createButtonSim({ pins, inputs, getValues: () => ({}), startedAt: 0 })
  let now = 0
  const tick = () => sim.update((now += 10))
  // One press and release, each seen by an update.
  function pressOnce() {
    inputs.setPressed('btn1', true)
    tick()
    inputs.setPressed('btn1', false)
    tick()
  }
  return { pins, inputs, sim, tick, pressOnce }
}

describe('createButtonSim', () => {
  it('reads D2 HIGH and D13 LOW released, D2 LOW and D13 HIGH pressed', () => {
    const { pins, inputs, tick } = setup()
    tick()
    expect([pins.get('D2'), pins.get('D13')]).toEqual([1, 0])
    inputs.setPressed('btn1', true)
    tick()
    expect([pins.get('D2'), pins.get('D13')]).toEqual([0, 1])
  })

  it('stop turns D13 off', () => {
    const { pins, inputs, sim, tick } = setup()
    inputs.setPressed('btn1', true)
    tick()
    sim.stop()
    expect(pins.get('D13')).toBe(0)
  })

  it('goal is false after 2 presses and true after 3', () => {
    const { sim, tick, pressOnce } = setup()
    tick()
    pressOnce()
    pressOnce()
    expect(sim.checkGoal()).toBe(false)
    pressOnce()
    expect(sim.checkGoal()).toBe(true)
  })

  it('does not count presses made before the first update', () => {
    const { inputs, sim, tick, pressOnce } = setup()
    inputs.setPressed('btn1', true)
    inputs.setPressed('btn1', false)
    inputs.setPressed('btn1', true)
    tick()
    inputs.setPressed('btn1', false)
    tick()
    pressOnce()
    pressOnce()
    expect(sim.checkGoal()).toBe(false)
    pressOnce()
    expect(sim.checkGoal()).toBe(true)
  })

  it('does not count a press that is held without release', () => {
    const { inputs, sim, tick, pressOnce } = setup()
    tick()
    pressOnce()
    pressOnce()
    inputs.setPressed('btn1', true)
    for (let i = 0; i < 10; i++) tick()
    expect(sim.checkGoal()).toBe(false)
  })
})
