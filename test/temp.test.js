import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createRoom } from '../src/sim/room.js'
import { createTempSim, tmp36Level, rawToC } from '../src/sim/temp.js'
import { createSerial } from '../src/sim/serial.js'

function setup() {
  const pins = createPins()
  const room = createRoom()
  const sim = createTempSim({ pins, room, getValues: () => ({}), startedAt: 0 })
  let now = 0
  const tick = () => sim.update((now += 10))
  return { pins, room, sim, tick }
}

describe('TMP36 helpers', () => {
  it('outputs 0.5 V at 0 deg C plus 10 mV per degree', () => {
    expect(tmp36Level(0) * 5).toBeCloseTo(0.5, 6)
    expect(tmp36Level(25) * 5).toBeCloseTo(0.75, 6)
  })

  it('converts a raw reading back to deg C like the sketch', () => {
    expect(rawToC(153)).toBeCloseTo((153 * 5 / 1023 - 0.5) * 100, 6)
    expect(rawToC(Math.round(tmp36Level(25) * 1023))).toBeCloseTo(25, 0)
  })
})

describe('createTempSim', () => {
  it('sets A0 from the room temperature and reads it out', () => {
    const { pins, sim, tick } = setup()
    tick()
    expect(pins.get('A0')).toBeCloseTo(tmp36Level(22), 6)
    expect(sim.readout()).toBe('A0 reads 147, 21.8 deg C')
    sim.stop()
    expect(pins.get('A0')).toBe(0)
  })

  it('goal needs 15 deg C or less and 30 deg C or more, in any order', () => {
    const { room, sim, tick } = setup()
    tick()
    room.setTempC(30)
    tick()
    expect(sim.checkGoal()).toBe(false)
    room.setTempC(16)
    tick()
    expect(sim.checkGoal()).toBe(false)
    room.setTempC(15)
    tick()
    expect(sim.checkGoal()).toBe(true)
  })

  it('prints deg C to Serial once a second, like the sketch', () => {
    const serial = createSerial()
    const sim = createTempSim({ pins: createPins(), room: createRoom(), serial, getValues: () => ({}), startedAt: 0 })
    sim.update(0)
    sim.update(500)
    sim.update(1000)
    expect(serial.getLines()).toEqual(['21.85 deg C', '21.85 deg C'])
  })
})
