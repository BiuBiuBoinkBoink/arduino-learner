import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createRoom } from '../src/sim/room.js'
import { createMonitorSim, lightAt, tempAt, DAY_MS, ALARM_HZ } from '../src/sim/monitor.js'

function setup(start = { darkLevel: 300, alarmC: 35 }) {
  const pins = createPins()
  const tones = createPins()
  const room = createRoom()
  const values = { ...start }
  const sim = createMonitorSim({ pins, tones, room, getValues: () => ({ ...values }), startedAt: 0 })
  let now = 0
  function run(ms) {
    const end = now + ms
    while (now < end) sim.update((now = Math.min(end, now + 50)))
  }
  return { pins, tones, room, values, sim, run, at: () => now }
}

describe('sim day', () => {
  it('is dark at night, bright at noon, coolest at 3 am and hottest at 3 pm', () => {
    expect(DAY_MS).toBe(24000)
    expect(lightAt(0)).toBeCloseTo(0.05, 6)
    expect(lightAt(12)).toBeCloseTo(0.95, 6)
    expect(tempAt(3)).toBeCloseTo(18, 6)
    expect(tempAt(15)).toBeCloseTo(34, 6)
  })
})

describe('createMonitorSim', () => {
  it('drives the room and the sensor pins from the sim clock', () => {
    const { pins, room, run } = setup()
    run(12000)
    expect(room.getLight()).toBeCloseTo(0.95, 2)
    expect(room.getTempC()).toBeCloseTo(tempAt(12), 1)
    expect(pins.get('A0')).toBeGreaterThan(0.5)
    expect(pins.get('A1')).toBeGreaterThan(0)
  })

  it('lights D13 in the dark and sounds 880 Hz on D8 when hot', () => {
    const { pins, tones, run } = setup({ darkLevel: 150, alarmC: 30 })
    run(1000)
    expect(pins.get('D13')).toBe(1)
    expect(tones.get('D8')).toBe(0)
    run(14000)
    expect(pins.get('D13')).toBe(0)
    expect(tones.get('D8')).toBe(ALARM_HZ)
  })

  it('stop clears the outputs and resets the room', () => {
    const { pins, tones, room, sim, run } = setup({ darkLevel: 150, alarmC: 30 })
    run(15000)
    sim.stop()
    expect(pins.get('D13')).toBe(0)
    expect(tones.get('D8')).toBe(0)
    expect(room.getLight()).toBe(0.8)
  })

  it('goal fails a day with the default thresholds', () => {
    const { sim, run } = setup()
    run(DAY_MS * 2 + 100)
    expect(sim.checkGoal()).toBe(false)
    expect(sim.readout()).toMatch(/Day 3 /)
  })

  it('goal passes after one whole correct day, not before', () => {
    const { sim, run } = setup({ darkLevel: 150, alarmC: 30 })
    run(DAY_MS - 100)
    expect(sim.checkGoal()).toBe(false)
    expect(sim.readout()).toMatch(/Day ok so far$/)
    run(200)
    expect(sim.checkGoal()).toBe(true)
  })

  it('a mistake fails that day, and the next whole correct day passes', () => {
    const { values, sim, run } = setup({ darkLevel: 150, alarmC: 30 })
    run(12000)
    // Above any reading, so the night light comes on at noon.
    values.darkLevel = 1024
    run(1000)
    expect(sim.readout()).toMatch(/missed, try the next day$/)
    values.darkLevel = 150
    run(DAY_MS - 13000 + 100)
    expect(sim.checkGoal()).toBe(false)
    run(DAY_MS)
    expect(sim.checkGoal()).toBe(true)
  })

  it('rejects an alarm that also sounds when cool, or a night light on by day', () => {
    const early = setup({ darkLevel: 150, alarmC: 27 })
    early.run(DAY_MS + 100)
    expect(early.sim.checkGoal()).toBe(false)
    const bright = setup({ darkLevel: 450, alarmC: 30 })
    bright.run(DAY_MS + 100)
    expect(bright.sim.checkGoal()).toBe(false)
  })
})
