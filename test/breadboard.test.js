import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  BREADBOARD_COLUMNS,
  BREADBOARD_ROWS,
  RAIL_ROWS,
  ALL_HOLES,
  parseHole,
  isHole,
  rowPitchZ,
  holePosition,
  holeStrip,
  createBreadboard
} from '../src/parts/breadboard.js'
import { PITCH } from '../src/parts/unoBoard.js'

describe('breadboard grid', () => {
  it('has 30 columns and rows a to j', () => {
    expect(BREADBOARD_COLUMNS).toBe(30)
    expect(BREADBOARD_ROWS).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])
  })

  it('parses column number plus row letter', () => {
    expect(parseHole('12e')).toEqual({ column: 12, row: 'e' })
    expect(parseHole('1a')).toEqual({ column: 1, row: 'a' })
    expect(parseHole('30j')).toEqual({ column: 30, row: 'j' })
  })

  it('rejects bad holes with an error naming the input', () => {
    for (const bad of ['0a', '31a', '5k', 'e5', '']) {
      expect(() => parseHole(bad)).toThrow(Error)
      expect(() => parseHole(bad)).toThrow(`'${bad}'`)
    }
  })

  it('spaces holes one pitch apart with a three pitch centre channel', () => {
    expect(holePosition('6c').x - holePosition('5c').x).toBeCloseTo(0.254, 6)
    expect(holePosition('5b').z - holePosition('5a').z).toBeCloseTo(0.254, 6)
    expect(holePosition('5f').z - holePosition('5e').z).toBeCloseTo(0.762, 6)
    expect(holePosition('5a').z).toBeLessThan(holePosition('5j').z)
    expect(holePosition('1c').x).toBeLessThan(holePosition('30c').x)
  })

  it('groups a to e and f to j of a column into separate strips', () => {
    expect(holeStrip('12a')).toBe('12-top')
    expect(holeStrip('12e')).toBe('12-top')
    expect(holeStrip('12f')).toBe('12-bottom')
    expect(holeStrip('12j')).toBe('12-bottom')
    expect(holeStrip('12c')).not.toBe(holeStrip('13c'))
    expect(() => holeStrip('31a')).toThrow('31a')
  })
})

describe('breadboard power rails', () => {
  it('names the four rails', () => {
    expect(RAIL_ROWS).toEqual(['T+', 'T-', 'B-', 'B+'])
  })

  it('parses rail holes as row then column', () => {
    expect(parseHole('T+12')).toEqual({ column: 12, row: 'T+' })
    expect(parseHole('T-1')).toEqual({ column: 1, row: 'T-' })
    expect(parseHole('B-30')).toEqual({ column: 30, row: 'B-' })
    expect(parseHole('B+7')).toEqual({ column: 7, row: 'B+' })
  })

  it('rejects bad rail holes', () => {
    expect(() => parseHole('T+31')).toThrow("Breadboard hole 'T+31' has a column outside 1 to 30")
    expect(() => parseHole('T+0')).toThrow("Breadboard hole 'T+0' has a column outside 1 to 30")
    for (const bad of ['T12', 'X+3', '+T3', 'T+', '12T+']) {
      expect(() => parseHole(bad)).toThrow(`Bad breadboard hole: '${bad}'`)
    }
    expect(() => parseHole('5k')).toThrow("Breadboard hole '5k' has a row outside a to j")
  })

  it('places rails outside the terminal rows, at the column of the terminal holes', () => {
    expect(holePosition('T+1').z).toBeCloseTo(-9 * PITCH, 6)
    expect(holePosition('T+1').x).toBeCloseTo(holePosition('1a').x, 6)
    expect(holePosition('T-1').z).toBeCloseTo(-8 * PITCH, 6)
    expect(holePosition('B-5').z).toBeCloseTo(8 * PITCH, 6)
    expect(holePosition('B+5').z).toBeCloseTo(9 * PITCH, 6)
    expect(holePosition('B+5').y).toBeCloseTo(holePosition('5j').y, 6)
    expect(rowPitchZ('a')).toBe(-5.5)
    expect(rowPitchZ('e')).toBe(-1.5)
    expect(rowPitchZ('f')).toBe(1.5)
    expect(rowPitchZ('j')).toBe(5.5)
    expect(rowPitchZ('T-')).toBe(-8)
    expect(() => rowPitchZ('k')).toThrow('k')
  })

  it('joins each rail along its whole length', () => {
    expect(holeStrip('T+12')).toBe('rail-T+')
    expect(holeStrip('T+1')).toBe(holeStrip('T+30'))
    expect(holeStrip('T-3')).toBe('rail-T-')
    expect(holeStrip('B-3')).toBe('rail-B-')
    expect(holeStrip('B+3')).toBe('rail-B+')
  })

  it('lists all 420 holes in a stable order', () => {
    expect(ALL_HOLES).toHaveLength(420)
    expect(new Set(ALL_HOLES).size).toBe(420)
    expect(ALL_HOLES.slice(0, 2)).toEqual(['T+1', 'T+2'])
    expect(ALL_HOLES[30]).toBe('T-1')
    expect(ALL_HOLES[60]).toBe('1a')
    expect(ALL_HOLES[359]).toBe('30j')
    expect(ALL_HOLES[360]).toBe('B-1')
    expect(ALL_HOLES[419]).toBe('B+30')
  })

  it('tells hole names from anything else without throwing', () => {
    for (const name of ['12e', 'T+12', 'B-30', '1a']) expect(isHole(name)).toBe(true)
    for (const name of ['D13', 'GND', 'T+31', '31a', '', null, undefined, 5]) expect(isHole(name)).toBe(false)
  })
})

describe('createBreadboard', () => {
  it('is half size and rests on the ground', () => {
    const { group } = createBreadboard()
    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    expect(box.min.y).toBeCloseTo(0, 3)
    expect(size.x).toBeGreaterThanOrEqual(7.5)
    expect(size.x).toBeLessThanOrEqual(9)
    expect(size.z).toBeGreaterThanOrEqual(3)
    expect(size.z).toBeLessThanOrEqual(6)
  })

  it('has one hole mark at each of the 420 hole positions, rails included', () => {
    const { group } = createBreadboard()
    const marks = group.children.filter((child) => child.name === 'hole')
    expect(marks).toHaveLength(420)
    for (const name of ALL_HOLES) {
      const target = holePosition(name)
      expect(marks.some((mark) => mark.position.distanceTo(target) < 1e-6), name).toBe(true)
    }
  })

  it('has red stripes outside the + rails and blue ones inside the - rails', () => {
    const { group } = createBreadboard()
    const stripes = group.children.filter((child) => child.name === 'stripe')
    const byZ = stripes.map((mesh) => [Math.round(mesh.position.z / PITCH * 10) / 10, mesh.material.color.getHex()]).sort((a, b) => a[0] - b[0])
    expect(byZ).toEqual([[-9.5, 0xd0312d], [-7.5, 0x2c6fd1], [7.5, 0x2c6fd1], [9.5, 0xd0312d]])
    for (const mesh of stripes) expect(mesh.castShadow).toBe(false)
  })

  it('reaches past the outer rails', () => {
    const { group } = createBreadboard()
    const box = new THREE.Box3().setFromObject(group)
    expect(box.min.z).toBeLessThan(holePosition('T+1').z - 0.1)
    expect(box.max.z).toBeGreaterThan(holePosition('B+1').z + 0.1)
  })

  it('has a body that casts and receives shadows', () => {
    const { group } = createBreadboard()
    const body = group.children.filter((child) => child.isMesh && child.castShadow)
    expect(body.length).toBeGreaterThan(0)
    for (const mesh of body) expect(mesh.receiveShadow).toBe(true)
  })
})
