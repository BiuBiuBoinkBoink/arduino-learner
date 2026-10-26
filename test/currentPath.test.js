import { describe, it, expect } from 'vitest'
import { tracePath, partEdges } from '../src/explain/currentPath.js'
import { circuits } from '../src/circuits/circuits.js'

const withPart = (circuit, id, change) => ({ ...circuit, parts: circuit.parts.map((part) => (part.id === id ? { ...part, ...change } : part)) })

describe('tracePath', () => {
  it('1.2 reaches GND from D13 through the resistor, then the LED', () => {
    const path = tracePath(circuits['1.2'], { from: 'D13' })
    expect(path.reachesGround).toBe(true)
    expect(path.parts).toEqual(['r1', 'led1'])
    expect(path.stop).toBe(null)
    expect(path.blocked).toBe(null)
    expect(path.hops).toEqual([
      { kind: 'wire', id: 'w1', from: 'D13', to: '5a' },
      { kind: 'strip', id: 'strip:5-top', from: '5a', to: '5c' },
      { kind: 'part', id: 'r1', from: '5c', to: '9c' },
      { kind: 'strip', id: 'strip:9-top', from: '9c', to: '9e' },
      { kind: 'part', id: 'led1', from: '9e', to: '10e' },
      { kind: 'strip', id: 'strip:10-top', from: '10e', to: '10a' },
      { kind: 'wire', id: 'w2', from: '10a', to: 'GND' }
    ])
  })

  it('a reversed LED blocks the path', () => {
    const build = withPart(circuits['1.2'], 'led1', { anode: '10e', cathode: '9e' })
    const path = tracePath(build, { from: 'D13' })
    expect(path.reachesGround).toBe(false)
    expect(path.parts).toEqual(['r1'])
    expect(path.blocked).toEqual({ id: 'led1', reason: 'reversed' })
    expect(path.stop.place).toBe('strip:9-top')
  })

  it('a resistor ending in strip 8 stops at strip 8, at a free hole', () => {
    const build = withPart(circuits['1.2'], 'r1', { to: '8c' })
    const path = tracePath(build, { from: 'D13' })
    expect(path.reachesGround).toBe(false)
    expect(path.parts).toEqual(['r1'])
    expect(path.stop.place).toBe('strip:8-top')
    expect(['8b', '8d']).toContain(path.stop.hole)
    expect(path.blocked).toBe(null)
    expect(path.hops.at(-1)).toEqual({ kind: 'part', id: 'r1', from: '5c', to: '8c' })
  })

  it('1.4 needs the button pressed to reach GND from D2', () => {
    const open = tracePath(circuits['1.4'], { from: 'D2' })
    expect(open.reachesGround).toBe(false)
    expect(open.parts).toEqual([])
    expect(open.stop.place).toBe('strip:12-top')
    const pressed = tracePath(circuits['1.4'], { from: 'D2', pressed: { btn1: true } })
    expect(pressed.reachesGround).toBe(true)
    expect(pressed.parts).toEqual(['btn1'])
    expect(pressed.hops.at(-1)).toMatchObject({ kind: 'wire', to: 'GND.2' })
  })

  it('1.8 from D10 reaches GND through r2 and the green leg', () => {
    const path = tracePath(circuits['1.8'], { from: 'D10' })
    expect(path.reachesGround).toBe(true)
    expect(path.parts).toEqual(['r2', 'rgb1'])
    expect(path.hops.find((hop) => hop.id === 'rgb1')).toEqual({ kind: 'part', id: 'rgb1', from: '16e', to: '15e' })
  })

  it('has no hops for a pin with nothing wired', () => {
    expect(tracePath(circuits['1.2'], { from: 'D7' })).toEqual({ hops: [], parts: [], reachesGround: false, stop: null, blocked: null })
    expect(tracePath({ parts: [], wires: [] }, { from: 'D13' }).hops).toEqual([])
  })

  it('a pin wired to an empty strip stops there', () => {
    const path = tracePath({ parts: [], wires: [{ id: 'u1', from: 'D13', to: '5a' }] }, { from: 'D13' })
    expect(path.hops).toEqual([{ kind: 'wire', id: 'u1', from: 'D13', to: '5a' }])
    expect(path.stop).toEqual({ place: 'strip:5-top', hole: '5b' })
  })

  it('gives each part type its current edges', () => {
    expect(partEdges({ id: 'led1', type: 'led' })).toEqual([['anode', 'cathode']])
    expect(partEdges({ id: 'b', type: 'button' })).toEqual([])
    expect(partEdges({ id: 'b', type: 'button' }, { b: true })).toHaveLength(2)
    expect(partEdges({ id: 'p', type: 'potentiometer' })).toHaveLength(6)
    expect(partEdges({ id: 't', type: 'tmp36' })).toEqual([])
    expect(partEdges({ id: 's', type: 'servo' })).toEqual([])
  })
})
