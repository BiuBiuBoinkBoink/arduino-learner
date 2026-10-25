import { describe, it, expect } from 'vitest'
import { suggest, joinPlaces, pendingPins, suggestionLabels } from '../src/circuits/suggest.js'
import { circuits } from '../src/circuits/circuits.js'
import { lessons } from '../src/course/lessons.js'
import { scopeFor } from '../src/course/steps.js'
import { compare } from '../src/circuits/netlist.js'
import { legsOf } from '../src/circuits/footprints.js'
import { createRuleContext, evaluateRule } from '../src/circuits/rules.js'

const lesson = lessons.find((item) => item.id === '1.2')
const reference = circuits['1.2']
const stepIndex = (id) => lesson.steps.findIndex((step) => step.id === id)
const stepOf = (id) => lesson.steps[stepIndex(id)]
const scopeOf = (id) => scopeFor(lesson, stepIndex(id))

// A reference part as a build part with legs (its reference legs unless given).
function placed(circuit, id, legs) {
  const part = circuit.parts.find((item) => item.id === id)
  const { anode, cathode, from, to, at, ...rest } = part
  return { ...rest, legs: legs || legsOf(part) }
}

// Applies a suggestion list to a build, as the workbench would.
function apply(build, items, circuit = reference) {
  const next = { parts: build.parts.slice(), wires: build.wires.slice() }
  let n = 1
  for (const item of items) {
    if (item.kind === 'unwire') next.wires = next.wires.filter((wire) => wire.id !== item.id)
    if (item.kind === 'wire') next.wires.push({ id: 'x' + n++, from: item.from, to: item.to, color: 'blue' })
    if (item.kind === 'part') next.parts = [...next.parts.filter((part) => part.id !== item.id), placed(circuit, item.id, item.legs)]
  }
  return next
}

function passes(step, build) {
  const rules = createRuleContext(build, reference)
  const check = step.check
  return check.items.every((item) => evaluateRule(item.rule, rules)) && (!check.pass || evaluateRule(check.pass, rules))
}

describe('suggest on build steps', () => {
  it('places each 1.2 part at its reference legs from an empty board', () => {
    const empty = { parts: [], wires: [] }
    expect(suggest(empty, reference, stepOf('place-led'), scopeOf('place-led'))).toEqual([{ kind: 'part', id: 'led1', legs: ['9e', '10e'] }])
    const withLed = { parts: [placed(reference, 'led1')], wires: [] }
    expect(suggest(withLed, reference, stepOf('add-resistor'), scopeOf('add-resistor'))).toEqual([{ kind: 'part', id: 'r1', legs: ['5c', '9c'] }])
  })

  it('gives nothing when the step already passes', () => {
    const withLed = { parts: [placed(reference, 'led1')], wires: [] }
    expect(suggest(withLed, reference, stepOf('place-led'), scopeOf('place-led'))).toEqual([])
  })

  it('follows an LED placed 11 columns right', () => {
    const build = { parts: [placed(reference, 'led1', ['20e', '21e'])], wires: [] }
    const items = suggest(build, reference, stepOf('add-resistor'), scopeOf('add-resistor'))
    expect(items).toEqual([{ kind: 'part', id: 'r1', legs: ['16c', '20c'] }])
    expect(passes(stepOf('add-resistor'), apply(build, items))).toBe(true)
  })

  it('moves a wrongly placed part', () => {
    const build = { parts: [placed(reference, 'led1', ['9c', '9d'])], wires: [] }
    expect(suggest(build, reference, stepOf('place-led'), scopeOf('place-led'))).toEqual([{ kind: 'part', id: 'led1', legs: ['9e', '10e'] }])
  })

  it('searches when the shifted legs do not fit', () => {
    // The LED moved 11 columns right, but a wire end sits where the shifted resistor would go.
    const build = { parts: [placed(reference, 'led1', ['20e', '21e'])], wires: [{ id: 'u1', from: 'D7', to: '16c', color: 'blue' }] }
    const items = suggest(build, reference, stepOf('add-resistor'), scopeOf('add-resistor'))
    expect(items).toHaveLength(1)
    expect(items[0].legs).not.toContain('16c')
    expect(passes(stepOf('add-resistor'), apply(build, items))).toBe(true)
  })

  it('finds a place for the LED when its reference holes are used', () => {
    const build = { parts: [], wires: [{ id: 'u1', from: 'D7', to: '9e', color: 'blue' }] }
    const items = suggest(build, reference, stepOf('place-led'), scopeOf('place-led'))
    expect(items).toHaveLength(1)
    expect(items[0].legs).not.toContain('9e')
    expect(passes(stepOf('place-led'), apply(build, items))).toBe(true)
  })
})

describe('suggest on wire steps', () => {
  const parts = () => [placed(reference, 'r1'), placed(reference, 'led1')]

  it('wires 1.2 D13 and GND to the holes nearest the reference ends', () => {
    const build = { parts: parts(), wires: [] }
    const items = suggest(build, reference, stepOf('wire-up'), scopeOf('wire-up'))
    expect(items).toEqual([{ kind: 'wire', from: 'D13', to: '5a' }, { kind: 'wire', from: 'GND', to: '10a' }])
    expect(compare(apply(build, items), reference).match).toBe(true)
  })

  it('wires a moved 1.2 circuit where it is', () => {
    const build = { parts: [placed(reference, 'r1', ['16c', '20c']), placed(reference, 'led1', ['20e', '21e'])], wires: [] }
    const items = suggest(build, reference, stepOf('wire-up'), scopeOf('wire-up'))
    expect(items).toEqual([{ kind: 'wire', from: 'D13', to: '16a' }, { kind: 'wire', from: 'GND', to: '21a' }])
  })

  it('wires 1.4', () => {
    const ref = circuits['1.4']
    const build = { parts: ref.parts.map((part) => placed(ref, part.id)), wires: [] }
    const step = { id: 'w', kind: 'wire', parts: [], check: { type: 'circuit', items: [], pass: { matches: 'all' } } }
    const items = suggest(build, ref, step, [])
    expect(items.map((item) => item.kind)).toEqual(['wire', 'wire', 'wire', 'wire'])
    expect(compare(apply(build, items, ref), ref).match).toBe(true)
  })

  it('takes out a wrong GND wire, then wires it right', () => {
    const build = { parts: parts(), wires: [{ id: 'u1', from: 'D13', to: '5a', color: 'yellow' }, { id: 'u2', from: 'GND', to: '9a', color: 'black' }] }
    expect(suggest(build, reference, stepOf('wire-up'), scopeOf('wire-up'))).toEqual([{ kind: 'unwire', id: 'u2' }, { kind: 'wire', from: 'GND', to: '10a' }])
  })

  it('takes out a wire from a pin the circuit does not use', () => {
    const build = {
      parts: parts(),
      wires: [
        { id: 'u1', from: 'D13', to: '5a', color: 'yellow' },
        { id: 'u2', from: 'GND', to: '10a', color: 'black' },
        { id: 'u3', from: '5V', to: '10b', color: 'red' }
      ]
    }
    expect(suggest(build, reference, stepOf('wire-up'), scopeOf('wire-up'))).toEqual([{ kind: 'unwire', id: 'u3' }])
  })

  it('gives nothing on other kinds of step', () => {
    expect(suggest({ parts: [], wires: [] }, reference, stepOf('guess'), [])).toEqual([])
  })
})

describe('level 0 helpers', () => {
  it('names the strip of the long leg for the resistor step', () => {
    const build = { parts: [placed(reference, 'led1', ['20e', '21e'])], wires: [] }
    expect(joinPlaces(build, reference, stepOf('add-resistor'), scopeOf('add-resistor'))).toEqual(['strip:20-top'])
    expect(joinPlaces(build, reference, stepOf('place-led'), scopeOf('place-led'))).toEqual([])
  })

  it('lists the pins whose wires are not right yet', () => {
    const build = { parts: [placed(reference, 'r1'), placed(reference, 'led1')], wires: [] }
    expect(pendingPins(build, reference)).toEqual(['D13', 'GND'])
    build.wires.push({ id: 'u1', from: 'D13', to: '5b', color: 'yellow' })
    expect(pendingPins(build, reference)).toEqual(['GND'])
    // GND in the long leg strip is still not right.
    build.wires.push({ id: 'u2', from: 'GND', to: '9b', color: 'black' })
    expect(pendingPins(build, reference)).toEqual(['GND'])
    build.wires[1].to = '10b'
    expect(pendingPins(build, reference)).toEqual([])
  })
})

describe('suggestionLabels', () => {
  it('words LED legs, bend ends and wires', () => {
    expect(suggestionLabels([
      { kind: 'part', id: 'led1', legs: ['9e', '10e'] },
      { kind: 'part', id: 'r1', legs: ['5c', '9c'] },
      { kind: 'wire', from: 'D13', to: '5a' },
      { kind: 'unwire', id: 'u2' }
    ], reference)).toEqual([
      { at: ['9e'], text: 'long leg: 9e' },
      { at: ['10e'], text: 'short leg: 10e' },
      { at: ['5c', '9c'], text: 'ends: 5c and 9c' },
      { at: ['5a'], text: 'D13 to 5a' }
    ])
  })
})
