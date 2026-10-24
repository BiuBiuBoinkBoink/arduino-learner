// Board helpers and board details the end to end goal tests do not reach.
import { describe, it, expect } from 'vitest'
import { createPins } from '../src/sim/pins.js'
import { createInputs } from '../src/sim/inputs.js'
import { createRoom } from '../src/sim/room.js'
import { ldrOhms, dividerLevel } from '../src/sim/light.js'
import { tmp36Level, rawToC } from '../src/sim/temp.js'
import { lightAt, tempAt, createMonitorSim, DAY_MS, REACT_MS } from '../src/sim/monitor.js'
import { noteName, NOTES, TARGET, createTuneSim } from '../src/sim/tune.js'
import { createPullDownSim } from '../src/sim/pullDown.js'
import { createBlinkSim } from '../src/sim/blink.js'
import { createFadeSim } from '../src/sim/fade.js'
import { createSweepSim, TARGETS, SPEED_DEG_PER_MS } from '../src/sim/sweep.js'

describe('sensor helpers', () => {
  it('photoresistor runs from about 1 Mohm dark to 1 kohm bright, reading higher with light', () => {
    expect(ldrOhms(0)).toBeCloseTo(1e6, 0)
    expect(ldrOhms(1)).toBeCloseTo(1000, 6)
    expect(dividerLevel(1)).toBeCloseTo(10 / 11, 6)
    expect(dividerLevel(0.5)).toBeGreaterThan(dividerLevel(0.2))
  })

  it('TMP36 outputs 0.5 V at 0 deg C plus 10 mV per degree, read back like the sketch', () => {
    expect(tmp36Level(25) * 5).toBeCloseTo(0.75, 6)
    expect(rawToC(Math.round(tmp36Level(25) * 1023))).toBeCloseTo(25, 0)
  })

  it('sim day is dark at night, bright at noon, 18 to 34 deg C', () => {
    expect(lightAt(0)).toBeCloseTo(0.05, 6)
    expect(lightAt(12)).toBeCloseTo(0.95, 6)
    expect(tempAt(3)).toBeCloseTo(18, 6)
    expect(tempAt(15)).toBeCloseTo(34, 6)
    expect(DAY_MS).toBe(24000)
  })

  it('names notes C to B and targets E D C', () => {
    expect(NOTES.map((note) => note.name).join('')).toBe('CDEFGAB')
    expect(TARGET.map(noteName)).toEqual(['E', 'D', 'C'])
    expect(noteName(123)).toBe('123 Hz')
  })
})

describe('boards', () => {
  it('1.5 drives D2 HIGH when pressed, LOW when fitted, and floats when removed', () => {
    const inputs = createInputs()
    let pull = 'down'
    const draws = [0.2, 0, 0.9, 0]
    const board = createPullDownSim({ pins: createPins(), inputs, getValues: () => ({ pull }), random: () => draws.shift() ?? 0.5 })
    expect(board.levels(0)).toEqual({ D2: 0 })
    inputs.setPressed('btn1', true)
    expect(board.levels(10)).toEqual({ D2: 1 })
    inputs.setPressed('btn1', false)
    pull = 'none'
    expect(board.levels(20)).toEqual({ D2: 0 })
    expect(board.levels(50)).toEqual({ D2: 0 })
    expect(board.levels(70)).toEqual({ D2: 1 })
  })

  it('1.2 and 1.7 forget timing across a code reload', () => {
    const blink = createBlinkSim()
    blink.output({ kind: 'pin', pin: 'D13', value: 1, at: 0 })
    blink.output({ kind: 'pin', pin: 'D13', value: 0, at: 100 })
    blink.reload()
    blink.output({ kind: 'pin', pin: 'D13', value: 1, at: 300 })
    expect(blink.checkGoal()).toBe(false)
    blink.output({ kind: 'pin', pin: 'D13', value: 0, at: 400 })
    blink.output({ kind: 'pin', pin: 'D13', value: 1, at: 500 })
    expect(blink.checkGoal()).toBe(true)

    const fade = createFadeSim()
    fade.output({ kind: 'pin', pin: 'D9', value: 0, at: 0 })
    fade.output({ kind: 'pin', pin: 'D9', value: 1, at: 900 })
    fade.reload()
    fade.output({ kind: 'pin', pin: 'D9', value: 0, at: 1500 })
    fade.output({ kind: 'pin', pin: 'D9', value: 0.5, at: 1600 })
    fade.output({ kind: 'pin', pin: 'D9', value: 1, at: 2000 })
    expect(fade.checkGoal()).toBe(false)
  })

  it('1.11 breaks the phrase at a long pause', () => {
    const tune = createTuneSim()
    const play = (hz, at) => tune.output({ kind: 'tone', pin: 'D8', value: hz, at })
    play(330, 0)
    play(294, 350)
    play(262, 2000)
    expect(tune.checkGoal()).toBe(false)
    play(330, 4000)
    play(294, 4350)
    play(262, 4700)
    expect(tune.checkGoal()).toBe(true)
  })

  it('1.12 moves the arm at servo speed and holds it with no command', () => {
    const servos = createPins()
    servos.set('D9', 90)
    const board = createSweepSim({ servos, startedAt: 0 })
    board.update(100)
    expect(servos.get('D9')).toBe(90)
    board.output({ kind: 'servo', pin: 'D9', value: 0 })
    board.update(200)
    expect(servos.get('D9')).toBeCloseTo(90 - SPEED_DEG_PER_MS * 100, 6)
    expect(TARGETS).toEqual([45, 90, 135])
  })

  it('P1 forgives a slow reaction, but not a lasting mistake', () => {
    const pins = createPins()
    const tones = createPins()
    const board = createMonitorSim({ pins, tones, room: createRoom(), startedAt: 0 })
    board.levels(0)
    board.update(0)
    board.levels(REACT_MS - 50)
    board.update(REACT_MS - 50)
    pins.set('D13', 1)
    board.update(REACT_MS)
    expect(board.readout()).toMatch(/ok so far$/)
    pins.set('D13', 0)
    board.update(REACT_MS + 100)
    board.update(REACT_MS * 2 + 200)
    expect(board.readout()).toMatch(/missed/)
  })
})
