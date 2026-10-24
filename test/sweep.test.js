import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createSweepSim, TARGETS, SPEED_DEG_PER_MS } from '../src/sim/sweep.js'

function setup(angle = 0, start = 90) {
  const servos = createPins()
  servos.set('D9', start)
  const values = { angle }
  const sim = createSweepSim({ servos, getValues: () => ({ ...values }), startedAt: 0 })
  let now = 0
  // Advances time in 16 ms frames.
  function run(ms) {
    const end = now + ms
    while (now < end) sim.update((now = Math.min(end, now + 16)))
  }
  return { servos, values, sim, run }
}

describe('createSweepSim', () => {
  it('moves the arm towards the angle at the servo speed', () => {
    const { servos, run } = setup(0)
    expect(SPEED_DEG_PER_MS).toBe(0.6)
    run(100)
    expect(servos.get('D9')).toBeCloseTo(90 - 60, 6)
    run(100)
    expect(servos.get('D9')).toBe(0)
  })

  it('follows a live angle change and clamps to 0 to 180', () => {
    const { servos, values, run } = setup(90)
    run(50)
    expect(servos.get('D9')).toBe(90)
    values.angle = 400
    run(1000)
    expect(servos.get('D9')).toBe(180)
  })

  it('holds the arm on stop', () => {
    const { servos, sim, run } = setup(45)
    run(200)
    sim.stop()
    expect(servos.get('D9')).toBe(45)
  })

  it('reads out the command, the arm and the targets left', () => {
    const { values, sim, run } = setup(0)
    run(16)
    expect(sim.readout()).toMatch(/^arm\.write\(0\), arm at \d+ deg\. Targets left: 45, 90, 135$/)
    values.angle = 45
    run(500)
    expect(sim.readout()).toBe('arm.write(45), arm at 45 deg. Targets left: 90, 135')
  })

  it('goal needs the arm to rest at 45, 90 and 135, and passing through does not count', () => {
    expect(TARGETS).toEqual([45, 90, 135])
    const { values, sim, run } = setup(180, 0)
    run(500)
    expect(sim.checkGoal()).toBe(false)
    for (const angle of [135, 45]) {
      values.angle = angle
      run(400)
    }
    expect(sim.checkGoal()).toBe(false)
    values.angle = 90
    run(400)
    expect(sim.checkGoal()).toBe(true)
  })
})
