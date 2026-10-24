import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createRoom } from '../src/sim/room.js'
import { createLightSim, ldrOhms, dividerLevel } from '../src/sim/light.js'

function setup() {
  const pins = createPins()
  const room = createRoom()
  const values = { darkLevel: 300 }
  const sim = createLightSim({ pins, room, getValues: () => ({ ...values }), startedAt: 0 })
  let now = 0
  const tick = () => sim.update((now += 10))
  return { pins, room, values, sim, tick }
}

describe('photoresistor divider', () => {
  it('runs from about 1 Mohm dark to 1 kohm bright', () => {
    expect(ldrOhms(0)).toBeCloseTo(1e6, 0)
    expect(ldrOhms(1)).toBeCloseTo(1000, 6)
    expect(ldrOhms(0.5)).toBeCloseTo(31623, 0)
  })

  it('reads higher with more light', () => {
    expect(dividerLevel(1)).toBeGreaterThan(dividerLevel(0.5))
    expect(dividerLevel(0.5)).toBeGreaterThan(dividerLevel(0))
    expect(dividerLevel(1)).toBeCloseTo(10 / 11, 6)
  })
})

describe('createLightSim', () => {
  it('sets A0 from the room and lights D13 below the dark level', () => {
    const { pins, room, sim, tick } = setup()
    tick()
    expect(pins.get('A0')).toBeCloseTo(dividerLevel(0.8), 6)
    expect(pins.get('D13')).toBe(0)
    expect(sim.readout()).toBe(`A0 reads ${Math.round(dividerLevel(0.8) * 1023)}, LED off`)
    room.setLight(0.2)
    tick()
    expect(pins.get('D13')).toBe(1)
    expect(sim.readout()).toMatch(/LED on$/)
    sim.stop()
    expect(pins.get('D13')).toBe(0)
  })

  it('follows a live dark level change', () => {
    const { pins, values, tick } = setup()
    tick()
    values.darkLevel = 900
    tick()
    expect(pins.get('D13')).toBe(1)
  })

  it('goal needs the LED to turn on and back off', () => {
    const { room, sim, tick } = setup()
    tick()
    room.setLight(0.1)
    tick()
    expect(sim.checkGoal()).toBe(false)
    room.setLight(0.9)
    tick()
    expect(sim.checkGoal()).toBe(true)
  })

  it('does not count the first state as a change', () => {
    const { room, sim, tick } = setup()
    room.setLight(0)
    tick()
    room.setLight(1)
    tick()
    expect(sim.checkGoal()).toBe(false)
  })
})
