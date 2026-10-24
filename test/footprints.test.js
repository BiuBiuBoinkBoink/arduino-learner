import { describe, it, expect } from 'vitest'
import {
  PART_TYPES,
  TERMINAL_LABELS,
  legsOf,
  terminalHoles,
  footprint,
  orientationCount,
  bendLegs,
  buttonHoles,
  potHoles,
  rgbHoles,
  buzzerHoles
} from '../src/circuits/footprints.js'
import * as built from '../src/circuits/buildCircuit.js'
import { holeName, rowAt } from '../src/circuits/holes.js'
import { circuits } from '../src/circuits/circuits.js'

// What buildCircuit used for each reference part before footprints existed.
function oldLegs(part) {
  switch (part.type) {
    case 'led': return [part.anode, part.cathode]
    case 'resistor':
    case 'ldr': return [part.from, part.to]
    case 'button': return buttonHoles(part.at)
    case 'rgbLed': return rgbHoles(part.at)
    case 'buzzer': return buzzerHoles(part.at)
    default: return potHoles(part.at)
  }
}

describe('hole helpers', () => {
  it('names holes by column and row, rails included, and null off the board', () => {
    expect(holeName(12, 'e')).toBe('12e')
    expect(holeName(3, 'T+')).toBe('T+3')
    expect(holeName(0, 'a')).toBe(null)
    expect(holeName(31, 'B-')).toBe(null)
    expect(holeName(3, 'k')).toBe(null)
  })

  it('finds the row a whole number of pitches away', () => {
    expect(rowAt('a', 1)).toBe('b')
    expect(rowAt('e', 1)).toBe(null)
    expect(rowAt('e', 3)).toBe('f')
    expect(rowAt('T+', 1)).toBe('T-')
    expect(rowAt('a', -1)).toBe(null)
    expect(rowAt('B+', -1)).toBe('B-')
  })
})

describe('part types', () => {
  it('lists every part type with its terminals and a label for each', () => {
    expect(Object.keys(PART_TYPES)).toEqual(['led', 'resistor', 'ldr', 'button', 'potentiometer', 'tmp36', 'servo', 'rgbLed', 'buzzer'])
    for (const [type, spec] of Object.entries(PART_TYPES)) {
      expect(Object.keys(TERMINAL_LABELS[type]).sort(), type).toEqual(spec.terminals.slice().sort())
    }
    expect(TERMINAL_LABELS.led).toEqual({ anode: 'long leg', cathode: 'short leg' })
    expect(TERMINAL_LABELS.servo.signal).toBe('orange signal wire')
    expect(PART_TYPES.buzzer.polar).toBe(false)
  })

  it('keeps the leg helpers importable from buildCircuit', () => {
    expect(built.buttonHoles).toBe(buttonHoles)
    expect(built.potHoles).toBe(potHoles)
    expect(built.rgbHoles).toBe(rgbHoles)
    expect(built.buzzerHoles).toBe(buzzerHoles)
  })
})

describe('legsOf', () => {
  it('matches what buildCircuit used for every reference part', () => {
    for (const [id, circuit] of Object.entries(circuits)) {
      for (const part of circuit.parts) expect(legsOf(part), id + ' ' + part.id).toEqual(oldLegs(part))
    }
  })

  it('reads reference positions and legs', () => {
    expect(legsOf({ type: 'led', anode: '9e', cathode: '10e' })).toEqual(['9e', '10e'])
    expect(legsOf({ type: 'resistor', from: '5c', to: '9c' })).toEqual(['5c', '9c'])
    expect(legsOf({ type: 'button', at: '12e' })).toEqual(['12e', '14e', '12f', '14f'])
    expect(legsOf({ type: 'servo', at: '12h' })).toEqual(['12h', '13h', '14h'])
    expect(legsOf({ type: 'buzzer', at: '20h' })).toEqual(['20h', '23h'])
    expect(legsOf({ type: 'led', legs: ['3a', '3b'] })).toEqual(['3a', '3b'])
  })

  it('gives no legs to an unplaced part', () => {
    expect(legsOf({ id: 'led1', type: 'led' })).toEqual([])
    expect(legsOf({ id: 'r1', type: 'resistor', ohms: 220 })).toEqual([])
    expect(legsOf({ id: 'btn1', type: 'button' })).toEqual([])
  })
})

describe('terminalHoles', () => {
  it('maps terminals to holes, two holes per button side', () => {
    expect(terminalHoles({ type: 'button', at: '12e' })).toEqual({ a: ['12e', '12f'], b: ['14e', '14f'] })
    expect(terminalHoles({ type: 'led', anode: '9e', cathode: '10e' })).toEqual({ anode: ['9e'], cathode: ['10e'] })
    expect(terminalHoles({ type: 'rgbLed', at: '14e' })).toEqual({ red: ['14e'], cathode: ['15e'], green: ['16e'], blue: ['17e'] })
    expect(terminalHoles({ type: 'led' })).toEqual({})
  })
})

describe('footprint', () => {
  it('has the right number of orientations per type', () => {
    expect(orientationCount('led')).toBe(4)
    expect(orientationCount('button')).toBe(1)
    expect(orientationCount('potentiometer')).toBe(2)
    expect(orientationCount('tmp36')).toBe(1)
    expect(orientationCount('servo')).toBe(1)
    expect(orientationCount('rgbLed')).toBe(2)
    expect(orientationCount('buzzer')).toBe(2)
    expect(orientationCount('nope')).toBe(0)
  })

  it('turns an LED four ways round its anode', () => {
    expect(footprint('led', '9b', 0)).toEqual(['9b', '10b'])
    expect(footprint('led', '9b', 1)).toEqual(['9b', '9c'])
    expect(footprint('led', '9b', 2)).toEqual(['9b', '8b'])
    expect(footprint('led', '9b', 3)).toEqual(['9b', '9a'])
    expect(footprint('led', 'T+4', 1)).toEqual(['T+4', 'T-4'])
    expect(footprint('led', 'B+4', 3)).toEqual(['B+4', 'B-4'])
  })

  it('never steps an LED across the channel or from a row to a rail', () => {
    expect(footprint('led', '9e', 1)).toBe(null)
    expect(footprint('led', '9f', 3)).toBe(null)
    expect(footprint('led', '9a', 3)).toBe(null)
    expect(footprint('led', 'T-9', 1)).toBe(null)
    expect(footprint('led', '30c', 0)).toBe(null)
    expect(footprint('led', '1c', 2)).toBe(null)
    expect(footprint('led', '9c', 4)).toBe(null)
  })

  it('puts a button across the channel or three rows down', () => {
    expect(footprint('button', '12e')).toEqual(['12e', '14e', '12f', '14f'])
    expect(footprint('button', '12a')).toEqual(['12a', '14a', '12d', '14d'])
    expect(footprint('button', '12b')).toEqual(['12b', '14b', '12e', '14e'])
    expect(footprint('button', '12f')).toEqual(['12f', '14f', '12i', '14i'])
    expect(footprint('button', '12g')).toEqual(['12g', '14g', '12j', '14j'])
    expect(footprint('button', '28e')).toEqual(['28e', '30e', '28f', '30f'])
    for (const bad of ['12c', '12d', '12h', '12i', '12j', 'T+12', '29e']) expect(footprint('button', bad), bad).toBe(null)
  })

  it('lays row parts along one row, flipped where allowed', () => {
    expect(footprint('potentiometer', '12e', 0)).toEqual(['12e', '13e', '14e'])
    expect(footprint('potentiometer', '12e', 1)).toEqual(['14e', '13e', '12e'])
    expect(footprint('tmp36', '12e', 0)).toEqual(['12e', '13e', '14e'])
    expect(footprint('tmp36', '12e', 1)).toBe(null)
    expect(footprint('servo', '12h')).toEqual(['12h', '13h', '14h'])
    expect(footprint('rgbLed', '14e', 0)).toEqual(['14e', '15e', '16e', '17e'])
    expect(footprint('rgbLed', '14e', 1)).toEqual(['17e', '16e', '15e', '14e'])
    expect(footprint('rgbLed', '28e', 0)).toBe(null)
    expect(footprint('potentiometer', '29a', 0)).toBe(null)
  })

  it('leaves a three column gap between buzzer legs', () => {
    expect(footprint('buzzer', '12e', 0)).toEqual(['12e', '15e'])
    expect(footprint('buzzer', '12e', 1)).toEqual(['15e', '12e'])
    expect(footprint('buzzer', '28e', 0)).toBe(null)
  })

  it('has no fixed footprint for bending parts or bad anchors', () => {
    expect(footprint('resistor', '5c', 0)).toBe(null)
    expect(footprint('led', '31a', 0)).toBe(null)
    expect(footprint('nope', '5c', 0)).toBe(null)
  })
})

describe('bendLegs', () => {
  it('spans 2 to 8 columns in a row for a resistor', () => {
    expect(bendLegs('resistor', '5c', '9c')).toEqual(['5c', '9c'])
    expect(bendLegs('resistor', '9c', '5c')).toEqual(['9c', '5c'])
    expect(bendLegs('resistor', '5c', '7c')).toEqual(['5c', '7c'])
    expect(bendLegs('resistor', '5c', '13c')).toEqual(['5c', '13c'])
    expect(bendLegs('resistor', '5c', '6c')).toBe(null)
    expect(bendLegs('resistor', '5c', '14c')).toBe(null)
    expect(bendLegs('resistor', 'T-3', 'T-10')).toEqual(['T-3', 'T-10'])
  })

  it('spans pitches in a column, across the channel too', () => {
    expect(bendLegs('resistor', '16d', '16g')).toEqual(['16d', '16g'])
    expect(bendLegs('resistor', '16a', '16c')).toEqual(['16a', '16c'])
    expect(bendLegs('resistor', '16a', '16b')).toBe(null)
    expect(bendLegs('resistor', 'T+16', '16a')).toEqual(['T+16', '16a'])
  })

  it('keeps the photoresistor to 6 and refuses bad input', () => {
    expect(bendLegs('ldr', '4c', '10c')).toEqual(['4c', '10c'])
    expect(bendLegs('ldr', '4c', '11c')).toBe(null)
    expect(bendLegs('resistor', '5c', '5c')).toBe(null)
    expect(bendLegs('resistor', '5c', '9d')).toBe(null)
    expect(bendLegs('resistor', '5c', 'D13')).toBe(null)
    expect(bendLegs('led', '5c', '9c')).toBe(null)
  })
})
