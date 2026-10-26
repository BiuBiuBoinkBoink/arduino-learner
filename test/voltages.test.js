import { describe, it, expect } from 'vitest'
import { netVoltages, pinVoltage } from '../src/explain/voltages.js'
import { buildNetlist } from '../src/circuits/netlist.js'
import { circuits } from '../src/circuits/circuits.js'

const withPart = (circuit, id, change) => ({ ...circuit, parts: circuit.parts.map((part) => (part.id === id ? { ...part, ...change } : part)) })

function voltsAt(build, levels, name) {
  return netVoltages(build, levels).get(buildNetlist(build).netOf(name).id)
}

describe('netVoltages', () => {
  it('1.2 with D13 HIGH: the anode strip at 2.0 V, the D13 net at 5.0 V, GND at 0', () => {
    const levels = { pinLevels: { D13: 1 } }
    expect(voltsAt(circuits['1.2'], levels, '9e')).toBeCloseTo(2.0)
    expect(voltsAt(circuits['1.2'], levels, 'D13')).toBeCloseTo(5.0)
    expect(voltsAt(circuits['1.2'], levels, '10a')).toBe(0)
  })

  it('1.2 with D13 LOW: everything at 0 V', () => {
    const levels = { pinLevels: { D13: 0 } }
    for (const name of ['9e', 'D13', '10a', '5b']) expect(voltsAt(circuits['1.2'], levels, name)).toBe(0)
  })

  it('a resistor to a dead end strip carries the pin voltage', () => {
    const build = withPart(circuits['1.2'], 'r1', { to: '8c' })
    expect(voltsAt(build, { pinLevels: { D13: 1 } }, '8a')).toBeCloseTo(5.0)
    // The anode strip now has no resistor: nothing fixes it.
    expect(voltsAt(build, { pinLevels: { D13: 1 } }, '9a')).toBe(null)
  })

  it('a pin with no level has no fixed voltage; input levels come from the board', () => {
    expect(voltsAt(circuits['1.2'], {}, 'D13')).toBe(null)
    expect(voltsAt(circuits['1.4'], { inputLevels: { D2: 1 } }, '12a')).toBeCloseTo(5.0)
    expect(pinVoltage('GND.2')).toBe(0)
    expect(pinVoltage('3.3V')).toBe(3.3)
    expect(pinVoltage('VIN')).toBe(9)
  })

  it('uses each colour forward voltage on the RGB LED', () => {
    const levels = { pinLevels: { D9: 1, D10: 1, D11: 1 } }
    expect(voltsAt(circuits['1.8'], levels, '14a')).toBeCloseTo(2.0)
    expect(voltsAt(circuits['1.8'], levels, '16a')).toBeCloseTo(3.0)
  })
})
