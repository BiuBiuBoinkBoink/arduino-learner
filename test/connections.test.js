import { describe, it, expect } from 'vitest'
import { describeNets } from '../src/explain/connections.js'
import { circuits } from '../src/circuits/circuits.js'

const withPart = (circuit, id, change) => ({ ...circuit, parts: circuit.parts.map((part) => (part.id === id ? { ...part, ...change } : part)) })

describe('describeNets', () => {
  it('lists the nets of the 1.2 reference, pins first, all matching', () => {
    const rows = describeNets(circuits['1.2'], circuits['1.2'])
    expect(rows.map((row) => row.things)).toEqual([
      ['D13', 'resistor'],
      ['GND', 'short leg of the LED'],
      ['long leg of the LED', 'resistor']
    ])
    expect(rows.every((row) => row.match === true)).toBe(true)
    expect(rows[0].places).toEqual(['strip:5-top'])
  })

  it('marks a broken connection as not matching', () => {
    const build = withPart(circuits['1.2'], 'r1', { to: '8c' })
    const rows = describeNets(build, circuits['1.2'])
    expect(rows.find((row) => row.places.includes('strip:8-top'))).toMatchObject({ things: ['resistor'], match: false })
    expect(rows.find((row) => row.places.includes('strip:9-top'))).toMatchObject({ things: ['long leg of the LED'], match: false })
    expect(rows.find((row) => row.things[0] === 'D13').match).toBe(true)
  })

  it('has no match without a reference and skips nets with no tokens', () => {
    const build = { parts: [], wires: [{ id: 'u1', from: '3a', to: '20a' }, { id: 'u2', from: 'D13', to: '5a' }] }
    expect(describeNets(build, null)).toEqual([{ id: 'pin:D13', things: ['D13'], places: ['strip:5-top'], match: null }])
  })

  it('matches swapped same value resistors in 1.8', () => {
    const build = { ...circuits['1.8'], parts: circuits['1.8'].parts.map((part) => (part.id === 'r1' ? { ...part, id: 'r3' } : part.id === 'r3' ? { ...part, id: 'r1' } : part)) }
    expect(describeNets(build, circuits['1.8']).every((row) => row.match)).toBe(true)
  })
})
