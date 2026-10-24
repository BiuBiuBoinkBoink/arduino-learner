import { describe, it, expect } from 'vitest'
import { autoWireColor, pinColor, WIRE_COLOR_NAMES } from '../src/build/wireColor.js'
import { WIRE_COLORS } from '../src/parts/wire.js'

const build = {
  parts: [{ id: 'r1', type: 'resistor', ohms: 220, legs: ['5c', '9c'] }],
  wires: [
    { id: 'w1', color: 'yellow', from: 'D13', to: '5a' },
    { id: 'w2', color: 'red', from: '5V', to: 'T+1' }
  ]
}

describe('wire colours', () => {
  it('names the same colours as the 3D wire', () => {
    expect(WIRE_COLOR_NAMES.slice().sort()).toEqual(Object.keys(WIRE_COLORS).sort())
  })

  it('colours wires from pins', () => {
    for (const pin of ['5V', '3.3V', 'VIN']) expect(autoWireColor(pin, build)).toBe('red')
    for (const pin of ['GND', 'GND.2', 'GND.3']) expect(autoWireColor(pin, build)).toBe('black')
    for (const pin of ['A0', 'A5']) expect(autoWireColor(pin, build)).toBe('green')
    for (const pin of ['D13', 'D2', 'AREF']) expect(autoWireColor(pin, build)).toBe('yellow')
    expect(pinColor('GND.2')).toBe('black')
  })

  it('colours wires from holes by the first pin in the net', () => {
    // 5b shares strip 5 with w1 from D13; a resistor does not join its ends.
    expect(autoWireColor('5b', build)).toBe('yellow')
    expect(autoWireColor('9e', build)).toBe('blue')
    expect(autoWireColor('T+20', build)).toBe('red')
  })

  it('colours rails and empty strips with no pin', () => {
    const empty = { parts: [], wires: [] }
    expect(autoWireColor('T+3', empty)).toBe('red')
    expect(autoWireColor('B+3', empty)).toBe('red')
    expect(autoWireColor('T-3', empty)).toBe('black')
    expect(autoWireColor('B-3', empty)).toBe('black')
    expect(autoWireColor('20f', empty)).toBe('blue')
    expect(autoWireColor('20f')).toBe('blue')
  })
})
