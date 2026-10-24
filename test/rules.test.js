import { describe, it, expect } from 'vitest'
import { createRuleContext, evaluateRule } from '../src/circuits/rules.js'
import { circuits } from '../src/circuits/circuits.js'

const clone = (circuit) => JSON.parse(JSON.stringify(circuit))
const check = (rule, build, reference) => evaluateRule(rule, createRuleContext(build, reference))

const r12 = circuits['1.2']
const r14 = circuits['1.4']
const led = r12.parts.find((part) => part.id === 'led1')
const resistor = r12.parts.find((part) => part.id === 'r1')
const ledOnly = { parts: [led], wires: [] }
const ledAndResistor = { parts: [led, resistor], wires: [] }

describe('evaluateRule on 1.2', () => {
  it('placed', () => {
    expect(check({ placed: 'led1' }, ledOnly, r12)).toBe(true)
    expect(check({ placed: 'r1' }, ledOnly, r12)).toBe(false)
    expect(check({ placed: 'r1' }, { parts: [{ id: 'r1', type: 'resistor', ohms: 220 }], wires: [] }, r12)).toBe(false)
  })

  it('apart', () => {
    expect(check({ apart: ['led1.anode', 'led1.cathode'] }, ledOnly, r12)).toBe(true)
    const squashed = { parts: [{ ...led, anode: '9a', cathode: '9b' }], wires: [] }
    expect(check({ apart: ['led1.anode', 'led1.cathode'] }, squashed, r12)).toBe(false)
    expect(check({ apart: ['led1.anode', 'r1.*'] }, ledOnly, r12)).toBe(false)
    expect(check({ apart: ['D13', 'GND'] }, r12, r12)).toBe(true)
  })

  it('allApart', () => {
    expect(check({ allApart: 'led1' }, ledOnly, r12)).toBe(true)
    expect(check({ allApart: 'led1' }, { parts: [{ ...led, anode: '9a', cathode: '9b' }], wires: [] }, r12)).toBe(false)
    expect(check({ allApart: 'r1' }, ledOnly, r12)).toBe(false)
  })

  it('joined', () => {
    expect(check({ joined: ['r1.*', 'led1.anode'] }, ledAndResistor, r12)).toBe(true)
    expect(check({ joined: ['r1.*', 'led1.cathode'] }, ledAndResistor, r12)).toBe(false)
    expect(check({ joined: ['D13', 'r1.*'] }, ledAndResistor, r12)).toBe(false)
    expect(check({ joined: ['D13', 'r1.*'] }, r12, r12)).toBe(true)
    const viaGnd2 = clone(r12)
    viaGnd2.wires[1].from = 'GND.2'
    expect(check({ joined: ['GND', 'led1.cathode'] }, viaGnd2, r12)).toBe(true)
  })

  it('wired', () => {
    expect(check({ wired: 'D13' }, r12, r12)).toBe(true)
    expect(check({ wired: 'GND.3' }, r12, r12)).toBe(true)
    expect(check({ wired: 'D12' }, r12, r12)).toBe(false)
    expect(check({ wired: 'D13' }, ledAndResistor, r12)).toBe(false)
  })

  it('noShorts', () => {
    expect(check({ noShorts: true }, r12, r12)).toBe(true)
    const shorted = clone(r12)
    shorted.wires.push({ id: 'w9', from: '5V', to: '10b' })
    expect(check({ noShorts: true }, shorted, r12)).toBe(false)
  })

  it('matches all and a list of parts', () => {
    expect(check({ matches: 'all' }, r12, r12)).toBe(true)
    expect(check({ matches: 'all' }, ledAndResistor, r12)).toBe(false)
    expect(check({ matches: ['led1', 'r1'] }, ledAndResistor, r12)).toBe(true)
    const touching = { parts: [led, { ...resistor, from: '10c', to: '9c' }], wires: [] }
    expect(check({ matches: ['led1', 'r1'] }, touching, r12)).toBe(false)
  })

  it('is false for an unknown rule', () => {
    expect(check({ nope: 1 }, r12, r12)).toBe(false)
    expect(check(null, r12, r12)).toBe(false)
  })
})

describe('evaluateRule on 1.4', () => {
  const btn = r14.parts.find((part) => part.id === 'btn1')

  it('placed, allApart and joined on the button', () => {
    const build = { parts: [btn], wires: [] }
    expect(check({ placed: 'btn1' }, build, r14)).toBe(true)
    expect(check({ allApart: 'btn1' }, build, r14)).toBe(true)
    const bridged = { parts: [btn], wires: [{ id: 'w9', from: '12b', to: '14b' }] }
    expect(check({ allApart: 'btn1' }, bridged, r14)).toBe(false)
    expect(check({ joined: ['D2', 'btn1.*'] }, r14, r14)).toBe(true)
    expect(check({ joined: ['D2', 'btn1.*'] }, build, r14)).toBe(false)
  })

  it('apart, wired, noShorts and matches on the whole circuit', () => {
    expect(check({ apart: ['D2', 'GND'] }, r14, r14)).toBe(true)
    expect(check({ wired: 'GND' }, r14, r14)).toBe(true)
    expect(check({ noShorts: true }, r14, r14)).toBe(true)
    expect(check({ matches: 'all' }, r14, r14)).toBe(true)
    const moved = clone(r14)
    moved.wires.find((wire) => wire.id === 'w3').to = '13a'
    expect(check({ matches: 'all' }, moved, r14)).toBe(false)
    expect(check({ matches: ['btn1'] }, moved, r14)).toBe(true)
    expect(check({ apart: ['D2', 'btn1.*'] }, moved, r14)).toBe(true)
  })
})
