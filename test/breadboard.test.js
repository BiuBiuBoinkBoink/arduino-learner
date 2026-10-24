import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  BREADBOARD_COLUMNS,
  BREADBOARD_ROWS,
  parseHole,
  holePosition,
  holeStrip,
  createBreadboard
} from '../src/parts/breadboard.js'

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

  it('has one hole mark at each of the 300 hole positions', () => {
    const { group } = createBreadboard()
    const marks = group.children.filter((child) => child.isMesh && !child.castShadow)
    expect(marks).toHaveLength(300)
    for (let column = 1; column <= 30; column++) {
      for (const row of BREADBOARD_ROWS) {
        const target = holePosition(`${column}${row}`)
        expect(marks.some((mark) => mark.position.distanceTo(target) < 1e-6)).toBe(true)
      }
    }
  })

  it('has a body that casts and receives shadows', () => {
    const { group } = createBreadboard()
    const body = group.children.filter((child) => child.isMesh && child.castShadow)
    expect(body.length).toBeGreaterThan(0)
    for (const mesh of body) expect(mesh.receiveShadow).toBe(true)
  })
})
