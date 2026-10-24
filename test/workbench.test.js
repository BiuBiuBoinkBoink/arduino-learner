import { describe, it, expect, beforeEach } from 'vitest'
import { createWorkbench, BUILD_KEY, REASONS, UNDO_LIMIT } from '../src/build/workbench.js'
import { kitFor } from '../src/build/kit.js'
import { circuits } from '../src/circuits/circuits.js'
import { compare } from '../src/circuits/netlist.js'
import { legsValid } from '../src/circuits/footprints.js'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  }
}

const reference = circuits['1.2']

function open(storage, lesson = { id: '1.2' }, ref = reference) {
  const bench = createWorkbench({ storage })
  const events = []
  bench.subscribe((event) => events.push(event))
  bench.load(lesson.id, { kit: kitFor(lesson, ref), reference: ref })
  return { bench, events }
}

describe('legsValid', () => {
  it('accepts footprints in any orientation and bends in range', () => {
    expect(legsValid('led', ['9e', '10e'])).toBe(true)
    expect(legsValid('led', ['10e', '9e'])).toBe(true)
    expect(legsValid('led', ['9e', '9d'])).toBe(true)
    expect(legsValid('led', ['9e', '11e'])).toBe(false)
    expect(legsValid('potentiometer', ['14e', '13e', '12e'])).toBe(true)
    expect(legsValid('tmp36', ['14e', '13e', '12e'])).toBe(false)
    expect(legsValid('button', ['12e', '14e', '12f', '14f'])).toBe(true)
    expect(legsValid('resistor', ['5c', '9c'])).toBe(true)
    expect(legsValid('resistor', ['5c', '6c'])).toBe(false)
    expect(legsValid('resistor', ['5c', '9d'])).toBe(false)
    expect(legsValid('led', [])).toBe(false)
    expect(legsValid('nope', ['9e', '10e'])).toBe(false)
    expect(legsValid('led', ['9e', 'x'])).toBe(false)
  })
})

describe('workbench', () => {
  let storage
  beforeEach(() => {
    storage = memoryStorage()
  })

  it('starts with every prebuilt item at its reference position', () => {
    const { bench, events } = open(storage)
    const build = bench.getBuild()
    expect(build.parts).toEqual([
      { id: 'r1', type: 'resistor', legs: ['5c', '9c'], ohms: 220 },
      { id: 'led1', type: 'led', legs: ['9e', '10e'], color: 'red', pin: 'D13' }
    ])
    expect(build.wires).toEqual(reference.wires)
    expect(compare(build, reference).match).toBe(true)
    expect(bench.tray()).toEqual({
      parts: [
        { id: 'r1', type: 'resistor', placed: true, prebuilt: true },
        { id: 'led1', type: 'led', placed: true, prebuilt: true }
      ],
      wires: { total: 4, used: 2 }
    })
    expect(events).toEqual([{ type: 'load', id: '1.2' }])
  })

  it('starts empty when the lesson prebuilds nothing', () => {
    const { bench } = open(storage, { id: '1.2', prebuilt: [] })
    expect(bench.getBuild()).toEqual({ parts: [], wires: [] })
    expect(bench.tray().parts.every((part) => !part.placed && !part.prebuilt)).toBe(true)
  })

  it('places, moves and removes kit parts', () => {
    const { bench, events } = open(storage, { id: '1.2', prebuilt: [] })
    expect(bench.place('led1', ['20e', '21e'])).toBe(true)
    expect(bench.place('led1', ['22e', '23e'])).toBe(true)
    expect(bench.getBuild().parts).toEqual([{ id: 'led1', type: 'led', legs: ['22e', '23e'], color: 'red', pin: 'D13' }])
    expect(bench.remove('led1')).toBe(true)
    expect(bench.remove('led1')).toBe(false)
    expect(bench.getBuild().parts).toEqual([])
    expect(events.map((event) => event.type)).toEqual(['load', 'place', 'move', 'remove'])
    expect(events[1].id).toBe('led1')
  })

  it('marks a moved prebuilt part as no longer built earlier', () => {
    const { bench } = open(storage)
    bench.place('led1', ['20e', '21e'])
    expect(bench.tray().parts[1]).toEqual({ id: 'led1', type: 'led', placed: true, prebuilt: false })
  })

  it('refuses taken holes and bad shapes with the exact reasons', () => {
    const { bench } = open(storage)
    expect(bench.canPlace('led1', ['5c', '6c'])).toEqual({ ok: false, reason: 'That hole is already used.' })
    expect(bench.canPlace('led1', ['5a', '6a'])).toEqual({ ok: false, reason: REASONS.holeUsed })
    expect(bench.canPlace('led1', ['20e', '22e'])).toEqual({ ok: false, reason: 'That part does not fit there.' })
    expect(bench.canPlace('nope', ['20e', '21e'])).toEqual({ ok: false, reason: REASONS.noFit })
    expect(bench.place('led1', ['5c', '6c'])).toBe(false)
    // Moving ignores the part's own holes.
    expect(bench.canPlace('led1', ['10e', '9e'])).toEqual({ ok: true })
    expect(bench.occupancy().get('9e')).toEqual({ kind: 'leg', id: 'led1' })
    expect(bench.occupancy().get('5a')).toEqual({ kind: 'wire', id: 'w1' })
    expect(bench.occupancy().has('D13')).toBe(false)
  })

  it('adds wires up to the kit limit with learner ids and auto colours', () => {
    const { bench, events } = open(storage)
    expect(bench.canWire('9e', 'D13')).toEqual({ ok: false, reason: 'Wires go from a pin or a hole to a hole.' })
    expect(bench.canWire('12a', '12a')).toEqual({ ok: false, reason: 'A wire needs two different ends.' })
    expect(bench.canWire('D13', '12a')).toEqual({ ok: false, reason: REASONS.holeUsed })
    expect(bench.canWire('12a', '5a')).toEqual({ ok: false, reason: REASONS.holeUsed })
    expect(bench.addWire('GND.2', '12a')).toBe('u1')
    expect(bench.addWire('12b', 'T+3', 'orange')).toBe('u2')
    expect(bench.canWire('5V', '20a')).toEqual({ ok: false, reason: 'You have used every wire in the kit.' })
    expect(bench.addWire('5V', '20a')).toBe(null)
    const wires = bench.getBuild().wires
    expect(wires.slice(2)).toEqual([
      { id: 'u1', from: 'GND.2', to: '12a', color: 'black' },
      { id: 'u2', from: '12b', to: 'T+3', color: 'orange' }
    ])
    expect(bench.tray().wires).toEqual({ total: 4, used: 4 })
    expect(bench.removeWire('u1')).toBe(true)
    expect(bench.removeWire('u1')).toBe(false)
    expect(bench.addWire('5V', '20a')).toBe('u1')
    expect(events.map((event) => event.type)).toEqual(['load', 'wire', 'wire', 'unwire', 'wire'])
  })

  it('undoes changes in order and keeps at most the undo limit', () => {
    const { bench, events } = open(storage)
    expect(bench.canUndo()).toBe(false)
    expect(bench.undo()).toBe(false)
    bench.place('led1', ['20e', '21e'])
    bench.removeWire('w2')
    expect(bench.undo()).toBe(true)
    expect(bench.getBuild().wires.map((wire) => wire.id)).toEqual(['w1', 'w2'])
    expect(bench.undo()).toBe(true)
    expect(compare(bench.getBuild(), reference).match).toBe(true)
    expect(bench.undo()).toBe(false)
    expect(events.filter((event) => event.type === 'undo')).toHaveLength(2)

    for (let i = 0; i < UNDO_LIMIT + 5; i++) bench.place('led1', i % 2 ? ['20e', '21e'] : ['22e', '23e'])
    let undone = 0
    while (bench.undo()) undone++
    expect(undone).toBe(UNDO_LIMIT)
  })

  it('resets to the prebuilt start and clears undo', () => {
    const { bench, events } = open(storage)
    bench.remove('led1')
    bench.addWire('5V', '20a')
    bench.reset()
    expect(compare(bench.getBuild(), reference).match).toBe(true)
    expect(bench.getBuild().wires).toHaveLength(2)
    expect(bench.undo()).toBe(false)
    expect(events.at(-1)).toEqual({ type: 'reset', id: null })
  })

  it('saves after every change and restores the build on load', () => {
    const first = open(storage).bench
    first.place('led1', ['20e', '21e'])
    first.addWire('GND.2', '21a')
    const saved = JSON.parse(storage.getItem(BUILD_KEY))
    expect(saved['1.2'].parts).toEqual([{ id: 'r1', legs: ['5c', '9c'] }, { id: 'led1', legs: ['20e', '21e'] }])
    expect(saved['1.2'].wires.at(-1)).toEqual({ id: 'u1', from: 'GND.2', to: '21a', color: 'black' })

    const second = open(storage).bench
    expect(second.getBuild()).toEqual(first.getBuild())
    expect(second.undo()).toBe(false)
  })

  it('keeps builds per lesson', () => {
    const { bench } = open(storage)
    bench.remove('led1')
    bench.load('1.7', { kit: kitFor({ id: '1.7' }, circuits['1.7']), reference: circuits['1.7'] })
    expect(bench.getBuild().parts).toHaveLength(2)
    bench.load('1.2', { kit: kitFor({ id: '1.2' }, reference), reference })
    expect(bench.getBuild().parts.map((part) => part.id)).toEqual(['r1'])
  })

  it('drops what fails in a corrupt record and keeps the rest', () => {
    storage.setItem(BUILD_KEY, JSON.stringify({
      '1.2': {
        parts: [
          { id: 'led1', legs: ['20e', '21e'] },
          { id: 'led1', legs: ['22e', '23e'] },
          { id: 'r1', legs: ['20c', '20e'] },
          { id: 'ghost', legs: ['1a', '2a'] },
          { id: 'r1', legs: 'nope' },
          null
        ],
        wires: [
          { id: 'w1', from: 'D13', to: '5a', color: 'yellow' },
          { id: 'u1', from: 'D13', to: '6a', color: 'yellow' },
          { id: 'u2', from: 'GND', to: '20e', color: 'black' },
          { id: 'x9', from: 'GND', to: '25a', color: 'black' },
          { id: 'u3', from: 'GND', to: '25a', color: 'purple' },
          { id: 'u4', from: 'GND', to: '25a', color: 'black' },
          { id: 'u5', from: '5V', to: '26a', color: 'red' },
          { id: 'u6', from: '3.3V', to: '27a', color: 'red' },
          { id: 'u7', from: 'VIN', to: '28a', color: 'red' },
          'bad'
        ]
      }
    }))
    const { bench } = open(storage)
    expect(bench.getBuild().parts).toEqual([{ id: 'led1', type: 'led', legs: ['20e', '21e'], color: 'red', pin: 'D13' }])
    // u1 reuses the D13 pin, u2 a used hole, x9 is not a known id, u3 has a bad colour; u7 is over the limit.
    expect(bench.getBuild().wires.map((wire) => wire.id)).toEqual(['w1', 'u4', 'u5', 'u6'])
  })

  it('falls back to the prebuilt start on unreadable storage', () => {
    storage.setItem(BUILD_KEY, '{not json')
    expect(compare(open(storage).bench.getBuild(), reference).match).toBe(true)
    storage.setItem(BUILD_KEY, JSON.stringify({ '1.2': 'nope' }))
    expect(compare(open(storage).bench.getBuild(), reference).match).toBe(true)
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    const { bench } = open(throwing)
    expect(bench.place('led1', ['20e', '21e'])).toBe(true)
  })

  it('places reference items, all or nothing', () => {
    const { bench, events } = open(storage, { id: '1.2', prebuilt: [] })
    bench.addWire('5V', '9e')
    expect(bench.placeReference(['r1', 'led1'])).toBe(false)
    expect(bench.getBuild().parts).toEqual([])
    bench.undo()
    expect(bench.placeReference(['r1', 'led1', 'w1'])).toBe(true)
    expect(bench.getBuild().parts.map((part) => part.legs)).toEqual([['5c', '9c'], ['9e', '10e']])
    expect(bench.getBuild().wires.map((wire) => wire.id)).toEqual(['w1'])
    expect(events.slice(-3).map((event) => event.type)).toEqual(['place', 'place', 'wire'])
    expect(bench.placeReference(['nope'])).toBe(false)
    expect(bench.undo()).toBe(true)
    expect(bench.getBuild().parts).toEqual([])
  })
})
