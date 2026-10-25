import { describe, it, expect } from 'vitest'
import {
  normalizePin,
  placeOf,
  buildNetlist,
  canonical,
  compare,
  align,
  diagnose,
  partLabel,
  thingLabel,
  placeLabel,
  formatOhms
} from '../src/circuits/netlist.js'
import { circuits } from '../src/circuits/circuits.js'
import { parseHole, holeName, isHole } from '../src/circuits/holes.js'
import { legsOf } from '../src/circuits/footprints.js'

const HOLE_FIELDS = ['anode', 'cathode', 'from', 'to', 'at']
const clone = (circuit) => JSON.parse(JSON.stringify(circuit))

function shiftHole(hole, k) {
  const { column, row } = parseHole(hole)
  return holeName(column + k, row)
}

// Every hole of the circuit moved k columns.
function shift(circuit, k) {
  const out = clone(circuit)
  for (const part of out.parts) {
    for (const field of HOLE_FIELDS) if (part[field]) part[field] = shiftHole(part[field], k)
    if (part.legs) part.legs = part.legs.map((hole) => shiftHole(hole, k))
  }
  for (const wire of out.wires) {
    if (isHole(wire.from)) wire.from = shiftHole(wire.from, k)
    wire.to = shiftHole(wire.to, k)
  }
  return out
}

function columns(circuit) {
  const holes = [
    ...circuit.parts.flatMap(legsOf),
    ...circuit.wires.flatMap((wire) => [wire.from, wire.to]).filter(isHole)
  ]
  return holes.map((hole) => parseHole(hole).column)
}

const ref = (id) => circuits[id]
const part = (circuit, id) => circuit.parts.find((item) => item.id === id)
const wire = (circuit, id) => circuit.wires.find((item) => item.id === id)
const ids = (mistakes) => mistakes.map((item) => item.id)

describe('netlist basics', () => {
  it('normalizes the GND pins and names places', () => {
    expect(normalizePin('GND')).toBe('GND')
    expect(normalizePin('GND.2')).toBe('GND')
    expect(normalizePin('GND.3')).toBe('GND')
    expect(normalizePin('D13')).toBe('D13')
    expect(placeOf('12e')).toBe('strip:12-top')
    expect(placeOf('12f')).toBe('strip:12-bottom')
    expect(placeOf('T+3')).toBe('rail:T+')
  })

  it('builds the 1.2 nets with stable ids', () => {
    const { nets, netOf } = buildNetlist(ref('1.2'))
    expect(nets).toEqual([
      { id: 'pin:D13', terms: ['r1.a'], pins: ['D13'], places: ['strip:5-top'] },
      { id: 'pin:GND', terms: ['led1.cathode'], pins: ['GND'], places: ['strip:10-top'] },
      { id: 'strip:9-top', terms: ['led1.anode', 'r1.b'], pins: [], places: ['strip:9-top'] }
    ])
    expect(netOf('led1.anode').id).toBe('strip:9-top')
    expect(netOf('term:r1.b').id).toBe('strip:9-top')
    expect(netOf('GND.2').id).toBe('pin:GND')
    expect(netOf('pin:GND.3').id).toBe('pin:GND')
    expect(netOf('9a').id).toBe('strip:9-top')
    expect(netOf('strip:5-top').id).toBe('pin:D13')
    expect(netOf('20a')).toBe(null)
    expect(netOf('D12')).toBe(null)
  })

  it('joins both button sides to their strips and skips unplaced parts', () => {
    const { netOf } = buildNetlist({ parts: [{ id: 'btn1', type: 'button', at: '12e' }, { id: 'r1', type: 'resistor', ohms: 220 }], wires: [] })
    expect(netOf('btn1.a').places).toEqual(['strip:12-bottom', 'strip:12-top'])
    expect(netOf('btn1.b').places).toEqual(['strip:14-bottom', 'strip:14-top'])
    expect(netOf('r1.a')).toBe(null)
  })

  it('gives canonical tokens by part kind, and keeps only some parts on request', () => {
    expect(canonical(buildNetlist(ref('1.2')), ref('1.2').parts)).toEqual(['D13,r1.*', 'GND,led1.cathode', 'led1.anode,r1.*'])
    expect(canonical(buildNetlist(ref('1.2')), ref('1.2').parts, { only: ['led1'] })).toEqual(['led1.anode', 'led1.cathode'])
    expect(canonical(buildNetlist(ref('1.6')), ref('1.6').parts)).toEqual(['5V,pot1.end', 'A0,pot1.wiper', 'GND,pot1.end'])
  })
})

describe('reference circuits', () => {
  for (const [id, circuit] of Object.entries(circuits)) {
    it(id + ' has no mistakes of its own and joins every terminal', () => {
      expect(diagnose(circuit, circuit)).toEqual([])
      expect(compare(circuit, circuit).match).toBe(true)
      const { nets } = buildNetlist(circuit)
      for (const net of nets) {
        if (net.terms.length === 0) continue
        expect(net.terms.length + net.pins.length, id + ' ' + net.id).toBeGreaterThan(1)
      }
    })

    it(id + ' still matches when shifted along the board', () => {
      const cols = columns(circuit)
      for (const k of [30 - Math.max(...cols), 1 - Math.min(...cols)].filter((value) => value !== 0)) {
        expect(compare(shift(circuit, k), circuit).match, id + ' by ' + k).toBe(true)
      }
    })
  }
})

describe('compare', () => {
  it('matches with a non polar part turned round', () => {
    const build = clone(ref('1.2'))
    Object.assign(part(build, 'r1'), { from: '9c', to: '5c' })
    expect(compare(build, ref('1.2')).match).toBe(true)
  })

  it('matches GND.2 in place of GND', () => {
    const build = clone(ref('1.2'))
    wire(build, 'w2').from = 'GND.2'
    expect(compare(build, ref('1.2')).match).toBe(true)
  })

  it('matches through a rail', () => {
    const build = clone(ref('1.2'))
    build.wires = [wire(build, 'w1'), { id: 'w2', from: 'GND', to: 'T-3' }, { id: 'w3', from: 'T-10', to: '10a' }]
    expect(compare(build, ref('1.2')).match).toBe(true)
  })

  it('reports missing and extra nets', () => {
    const build = clone(ref('1.2'))
    wire(build, 'w1').from = 'D12'
    expect(compare(build, ref('1.2'))).toEqual({ match: false, missing: ['D13,r1.*'], extra: ['D12,r1.*'] })
  })

  it('aligns interchangeable resistors in 1.8', () => {
    const build = clone(ref('1.8'))
    const r1 = part(build, 'r1')
    const r2 = part(build, 'r2')
    const holes = [r1.from, r1.to]
    Object.assign(r1, { from: r2.from, to: r2.to })
    Object.assign(r2, { from: holes[0], to: holes[1] })
    expect(compare(build, ref('1.8')).match).toBe(true)
    const aligned = align(build, ref('1.8'))
    expect(part(aligned, 'r1').from).toBe('8c')
    expect(part(build, 'r1').from).toBe('16d')
  })

  it('keeps ids on a tie', () => {
    const build = clone(ref('1.8'))
    expect(align(build, ref('1.8')).parts.map((item) => item.id)).toEqual(['rgb1', 'r1', 'r2', 'r3'])
  })
})

describe('diagnose on 1.2', () => {
  it('finds an LED in backwards', () => {
    const build = clone(ref('1.2'))
    Object.assign(part(build, 'led1'), { anode: '10e', cathode: '9e' })
    const [first] = diagnose(build, ref('1.2'))
    expect(first).toEqual({
      id: 'reversed',
      text: 'The LED is in backwards. Pick it up and press R to turn it round.',
      targets: { parts: ['led1'], holes: ['10e', '9e'], pins: [], places: [] }
    })
  })

  it('finds both resistor legs in one strip', () => {
    const build = clone(ref('1.2'))
    const r1 = part(build, 'r1')
    delete r1.from
    delete r1.to
    r1.legs = ['9a', '9d']
    const [first] = diagnose(build, ref('1.2'))
    expect(first.id).toBe('same-net')
    expect(first.text).toBe('Both legs of the resistor are in strip 9 (rows a to e), so the current goes round it.')
    expect(first.targets).toEqual({ parts: ['r1'], holes: ['9a', '9d'], pins: [], places: ['strip:9-top'] })
  })

  it('finds a wire on the wrong pin', () => {
    const build = clone(ref('1.2'))
    wire(build, 'w1').from = 'D12'
    const [first] = diagnose(build, ref('1.2'))
    expect(first.id).toBe('wrong-pin')
    expect(first.text).toBe('This wire goes to D12. The sketch uses D13.')
    expect(first.targets.holes).toEqual(['5a'])
  })

  it('finds an LED with no resistor', () => {
    const build = clone(ref('1.2'))
    build.parts = build.parts.filter((item) => item.id !== 'r1')
    wire(build, 'w1').to = '9a'
    const [first] = diagnose(build, ref('1.2'))
    expect(first.id).toBe('no-resistor')
    expect(first.text).toBe('Nothing limits the current. Put the resistor between D13 and the LED.')
    expect(ids(diagnose(build, ref('1.2')))).toContain('missing')
  })

  it('finds a wire that ends in an empty strip', () => {
    const build = clone(ref('1.2'))
    wire(build, 'w2').to = '20a'
    const [first] = diagnose(build, ref('1.2'))
    expect(first.id).toBe('loose-wire')
    expect(first.text).toBe('The wire from GND ends in strip 20 (rows a to e), which has nothing else in it.')
  })

  it('finds a short from 5V to GND', () => {
    const build = clone(ref('1.2'))
    build.wires.push({ id: 'w9', from: '5V', to: '10b' })
    const [first] = diagnose(build, ref('1.2'))
    expect(first.id).toBe('short')
    expect(first.text).toBe('This joins 5V straight to GND. On a real board that is a short circuit.')
    expect(first.targets.pins).toEqual(['5V', 'GND'])
  })

  it('asks for a missing LED first', () => {
    const build = clone(ref('1.2'))
    build.parts = build.parts.filter((item) => item.id !== 'led1')
    const [first] = diagnose(build, ref('1.2'))
    expect(first).toEqual({ id: 'missing', text: 'Place the LED from the tray.', targets: { parts: ['led1'], holes: [], pins: [], places: [] } })
  })

  it('says which things are not joined, before a loose end', () => {
    const build = clone(ref('1.2'))
    part(build, 'r1').to = '8c'
    const found = diagnose(build, ref('1.2'))
    expect(found[0].id).toBe('not-joined')
    expect(found[0].text).toBe('The long leg of the LED and the resistor are not joined yet.')
    expect(ids(found)).toContain('loose')
    expect(found.find((item) => item.id === 'loose').text).toBe('The end of the resistor is not joined to anything yet.')
  })

  it('looks at the given parts only', () => {
    const build = { parts: [{ id: 'led1', type: 'led', color: 'red', pin: 'D13', anode: '9e', cathode: '10e' }], wires: [] }
    expect(diagnose(build, ref('1.2'), { only: ['led1'] })).toEqual([])
    expect(ids(diagnose(build, ref('1.2'), { only: ['led1', 'r1'] }))[0]).toBe('missing')
  })
})

describe('diagnose with an empty reference', () => {
  const empty = { parts: [], wires: [] }

  it('handles an empty build and reference', () => {
    expect(diagnose({ parts: [], wires: [] }, empty)).toEqual([])
  })

  it('names two legs of a part in one place, and nothing for power on a bare rail', () => {
    const build = {
      parts: [{ id: 'r1', type: 'resistor', ohms: 220, legs: ['5c', '5e'] }],
      wires: [{ id: 'u1', from: '5V', to: 'T+3', color: 'red' }]
    }
    expect(ids(diagnose(build, empty))).toEqual(['same-net'])
    build.parts[0].legs = ['5c', '9c']
    expect(diagnose(build, empty)).toEqual([])
  })

  it('still finds a short', () => {
    const build = { parts: [], wires: [{ id: 'u1', from: '5V', to: 'T+3', color: 'red' }, { id: 'u2', from: 'GND', to: 'T+9', color: 'black' }] }
    expect(ids(diagnose(build, empty))).toEqual(['short'])
  })
})

describe('diagnose on other lessons', () => {
  it('finds a 1.4 button that does not cross the centre gap', () => {
    const build = clone(ref('1.4'))
    const btn = part(build, 'btn1')
    delete btn.at
    btn.legs = ['12a', '14a', '12d', '14d']
    const [first] = diagnose(build, ref('1.4'))
    expect(first.id).toBe('button-gap')
    expect(first.text).toBe('Put the button across the centre gap so each side gets its own strips.')
  })

  it('finds a button with both sides in one net', () => {
    const build = { parts: [{ id: 'btn1', type: 'button', at: '12e' }], wires: [{ id: 'w9', from: '12b', to: '14b' }] }
    expect(diagnose(build, ref('1.4'), { only: ['btn1'] })[0].id).toBe('button-gap')
    // With the lesson wires it also joins D2 to GND, and the short comes first.
    const wired = clone(ref('1.4'))
    wired.wires.push({ id: 'w9', from: '12b', to: '14b' })
    expect(ids(diagnose(wired, ref('1.4'))).slice(0, 2)).toEqual(['short', 'button-gap'])
  })

  it('finds 5V and GND swapped on the 1.10 TMP36', () => {
    const build = clone(ref('1.10'))
    wire(build, 'w1').to = '14a'
    wire(build, 'w3').to = '12a'
    const [first] = diagnose(build, ref('1.10'))
    expect(first.id).toBe('reversed')
    expect(first.text).toBe('5V and GND go to the wrong TMP36 legs. With its flat face towards you, the legs are +Vs, Vout and GND from left to right.')
  })

  it('finds an RGB LED turned round', () => {
    const build = clone(ref('1.8'))
    const rgb = part(build, 'rgb1')
    rgb.legs = ['17e', '16e', '15e', '14e']
    delete rgb.at
    expect(diagnose(build, ref('1.8'))[0].text).toBe('The RGB LED is the wrong way round. Pick it up and press R to flip it.')
  })

  it('names two legs of a three leg part in one strip', () => {
    const build = clone(ref('1.6'))
    const pot = part(build, 'pot1')
    delete pot.at
    pot.legs = ['12a', '12b', '14a']
    const [first] = diagnose(build, ref('1.6'))
    expect(first.id).toBe('same-net')
    expect(first.text).toBe('Two legs of the potentiometer share strip 12 (rows a to e). Give each leg its own strip.')
  })
})

describe('wording', () => {
  it('formats ohms', () => {
    expect(formatOhms(220)).toBe('220 ohm')
    expect(formatOhms(1000)).toBe('1 kohm')
    expect(formatOhms(10000)).toBe('10 kohm')
    expect(formatOhms(4700)).toBe('4.7 kohm')
  })

  it('labels places', () => {
    expect(placeLabel('strip:9-top')).toBe('strip 9 (rows a to e)')
    expect(placeLabel('strip:9-bottom')).toBe('strip 9 (rows f to j)')
    expect(placeLabel('rail:T+')).toBe('the top + rail')
    expect(placeLabel('rail:T-')).toBe('the top - rail')
    expect(placeLabel('rail:B-')).toBe('the bottom - rail')
    expect(placeLabel('rail:B+')).toBe('the bottom + rail')
  })

  it('labels parts, adding the value or id only when needed', () => {
    const r1 = { id: 'r1', type: 'resistor', ohms: 220 }
    const r2 = { id: 'r2', type: 'resistor', ohms: 10000 }
    const r3 = { id: 'r3', type: 'resistor', ohms: 220 }
    const led = { id: 'led1', type: 'led', color: 'red' }
    expect(partLabel(r1, [r1, led])).toBe('resistor')
    expect(partLabel(r1, [r1, r2])).toBe('220 ohm resistor')
    expect(partLabel(r2, [r1, r2])).toBe('10 kohm resistor')
    expect(partLabel(r3, [r1, r2, r3])).toBe('resistor r3')
    expect(partLabel(led, [led, { id: 'led2', type: 'led', color: 'green' }])).toBe('red LED')
    expect(partLabel({ id: 'ldr1', type: 'ldr' }, [])).toBe('photoresistor')
  })

  it('labels things in a net', () => {
    const parts = ref('1.2').parts
    expect(thingLabel('D13', parts)).toBe('D13')
    expect(thingLabel('GND.2', parts)).toBe('GND')
    expect(thingLabel('led1.anode', parts)).toBe('long leg of the LED')
    expect(thingLabel('r1.*', parts)).toBe('resistor')
    expect(thingLabel('pot1.end', ref('1.6').parts)).toBe('outer leg of the potentiometer')
    expect(thingLabel('pot1.wiper', ref('1.6').parts)).toBe('middle leg of the potentiometer')
    expect(thingLabel('tmp1.vout', ref('1.10').parts)).toBe('Vout leg of the TMP36')
  })
})
