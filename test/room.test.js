import { describe, it, expect } from 'vitest'
import { createRoom, DEFAULT_LIGHT, DEFAULT_TEMP_C } from '../src/sim/room.js'

describe('createRoom', () => {
  it('starts at the default light and temperature', () => {
    const room = createRoom()
    expect(room.getLight()).toBe(DEFAULT_LIGHT)
    expect(room.getTempC()).toBe(DEFAULT_TEMP_C)
    expect([DEFAULT_LIGHT, DEFAULT_TEMP_C]).toEqual([0.8, 22])
  })

  it('clamps light to 0 to 1 and temperature to 0 to 40 deg C', () => {
    const room = createRoom()
    room.setLight(2)
    expect(room.getLight()).toBe(1)
    room.setLight(-1)
    expect(room.getLight()).toBe(0)
    room.setTempC(80)
    expect(room.getTempC()).toBe(40)
    room.setTempC(-5)
    expect(room.getTempC()).toBe(0)
  })

  it('notifies (name, value) only on a real change, and reset goes back to the defaults', () => {
    const room = createRoom()
    const seen = []
    room.subscribe((name, value) => seen.push([name, value]))
    room.setLight(0.8)
    room.setLight(0.3)
    room.setTempC(22)
    room.setTempC(30)
    room.reset()
    expect(seen).toEqual([['light', 0.3], ['tempC', 30], ['light', 0.8], ['tempC', 22]])
  })
})
