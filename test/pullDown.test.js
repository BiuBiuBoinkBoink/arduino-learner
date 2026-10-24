import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createInputs } from '../src/sim/inputs.js'
import { createPullDownSim } from '../src/sim/pullDown.js'

// Small seeded generator so the floating pin is repeatable.
function seeded(seed) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

function setup() {
  const pins = createPins()
  const inputs = createInputs()
  const values = { pull: 'down' }
  const sim = createPullDownSim({ pins, inputs, getValues: () => values, startedAt: 0, random: seeded(7) })
  let now = 0
  const tick = () => sim.update((now += 10))
  function pressOnce() {
    inputs.setPressed('btn1', true)
    tick()
    inputs.setPressed('btn1', false)
    tick()
  }
  return { pins, inputs, values, sim, tick, pressOnce }
}

describe('createPullDownSim', () => {
  it('reads 1 pressed and 0 released with the pull down fitted, D13 copies D2', () => {
    const { pins, inputs, tick } = setup()
    tick()
    expect([pins.get('D2'), pins.get('D13')]).toEqual([0, 0])
    inputs.setPressed('btn1', true)
    tick()
    expect([pins.get('D2'), pins.get('D13')]).toEqual([1, 1])
  })

  it('floats with the pull down removed: D2 changes over time, D13 follows', () => {
    const { pins, values, tick } = setup()
    values.pull = 'none'
    const levels = []
    for (let i = 0; i < 200; i++) {
      tick()
      levels.push(pins.get('D2'))
      expect(pins.get('D13')).toBe(pins.get('D2'))
    }
    expect(levels).toContain(0)
    expect(levels).toContain(1)
    const changes = levels.filter((level, i) => i > 0 && level !== levels[i - 1]).length
    // 2000 ms of 40 to 160 ms random levels gives some changes, not one per tick.
    expect(changes).toBeGreaterThan(2)
    expect(changes).toBeLessThan(100)
  })

  it('reads 1 while pressed even with the pull down removed', () => {
    const { pins, inputs, values, tick } = setup()
    values.pull = 'none'
    inputs.setPressed('btn1', true)
    for (let i = 0; i < 50; i++) {
      tick()
      expect(pins.get('D2')).toBe(1)
    }
  })

  it('goal is true after 3 presses with the pull down fitted', () => {
    const { sim, tick, pressOnce } = setup()
    tick()
    pressOnce()
    pressOnce()
    expect(sim.checkGoal()).toBe(false)
    pressOnce()
    expect(sim.checkGoal()).toBe(true)
  })

  it('removing the pull down mid way resets the count, and presses while removed do not count', () => {
    const { values, sim, tick, pressOnce } = setup()
    tick()
    pressOnce()
    pressOnce()
    values.pull = 'none'
    tick()
    pressOnce()
    pressOnce()
    pressOnce()
    expect(sim.checkGoal()).toBe(false)
    values.pull = 'down'
    tick()
    pressOnce()
    pressOnce()
    expect(sim.checkGoal()).toBe(false)
    pressOnce()
    expect(sim.checkGoal()).toBe(true)
  })

  it('stop turns D13 off', () => {
    const { pins, inputs, sim, tick } = setup()
    inputs.setPressed('btn1', true)
    tick()
    sim.stop()
    expect(pins.get('D13')).toBe(0)
  })
})
