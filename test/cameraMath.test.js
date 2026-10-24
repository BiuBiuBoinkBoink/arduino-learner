import { describe, it, expect } from 'vitest'
import { easeInOut, lerpVec, viewFor } from '../src/scene/cameraMath.js'

const camera = { fov: 45, aspect: 16 / 9 }
const box = { min: { x: -10, y: 0, z: -4 }, max: { x: 10, y: 2, z: 4 } }
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

describe('easeInOut', () => {
  it('starts at 0, ends at 1 and clamps', () => {
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(1)).toBe(1)
    expect(easeInOut(0.5)).toBeCloseTo(0.5)
    expect(easeInOut(-1)).toBe(0)
    expect(easeInOut(2)).toBe(1)
  })
})

describe('lerpVec', () => {
  it('blends plain vectors', () => {
    expect(lerpVec({ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: -6 }, 0.5)).toEqual({ x: 1, y: 2, z: -3 })
  })
})

describe('viewFor', () => {
  it('puts the top view straight above the box centre', () => {
    const { position, target } = viewFor('top', box, camera)
    expect(target).toEqual({ x: 0, y: 1, z: 0 })
    expect(position.x).toBe(0)
    expect(position.z).toBeCloseTo(0.001)
    expect(position.y).toBeGreaterThan(target.y)
  })

  it('looks at the 3d view from the +z side at 45 deg', () => {
    const { position, target } = viewFor('3d', box, camera)
    expect(position.z).toBeGreaterThan(target.z)
    expect(position.y - target.y).toBeCloseTo(position.z - target.z)
  })

  it('moves further away when the box grows', () => {
    const big = { min: { x: -20, y: 0, z: -8 }, max: { x: 20, y: 2, z: 8 } }
    for (const kind of ['top', '3d']) {
      const small = viewFor(kind, box, camera)
      const large = viewFor(kind, big, camera)
      expect(dist(large.position, large.target)).toBeGreaterThan(dist(small.position, small.target))
    }
  })

  it('needs less distance for a wide box on a wide aspect than a tall one', () => {
    const wide = viewFor('top', box, { fov: 45, aspect: 2 })
    const tall = viewFor('top', box, { fov: 45, aspect: 0.5 })
    expect(dist(wide.position, wide.target)).toBeLessThan(dist(tall.position, tall.target))
  })
})
