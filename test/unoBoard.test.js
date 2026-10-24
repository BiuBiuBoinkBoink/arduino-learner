import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createUnoBoard, UNO_ZONE_IDS } from '../src/parts/unoBoard.js'

function meshesOf(object) {
  const meshes = []
  object.traverse((child) => {
    if (child.isMesh) meshes.push(child)
  })
  return meshes
}

function isDescendant(object, ancestor) {
  for (let node = object.parent; node; node = node.parent) {
    if (node === ancestor) return true
  }
  return false
}

describe('createUnoBoard', () => {
  it('lists the six zone ids in order', () => {
    expect(UNO_ZONE_IDS).toEqual(['digital', 'analog', 'power', 'usb-power', 'chip', 'reset'])
  })

  it('returns a group and exactly the six zones', () => {
    const { group, zones } = createUnoBoard()
    expect(group).toBeInstanceOf(THREE.Group)
    expect(Object.keys(zones).sort()).toEqual([...UNO_ZONE_IDS].sort())
  })

  it('puts each zone under the group with its id and at least one mesh', () => {
    const { group, zones } = createUnoBoard()
    for (const id of UNO_ZONE_IDS) {
      const zone = zones[id]
      expect(zone).toBeInstanceOf(THREE.Object3D)
      expect(isDescendant(zone, group)).toBe(true)
      expect(zone.userData.zoneId).toBe(id)
      expect(meshesOf(zone).length).toBeGreaterThan(0)
    }
  })

  it('does not share a material between two zones', () => {
    const { zones } = createUnoBoard()
    const owner = new Map()
    for (const id of UNO_ZONE_IDS) {
      for (const mesh of meshesOf(zones[id])) {
        const seen = owner.get(mesh.material)
        if (seen) expect(seen).toBe(id)
        owner.set(mesh.material, id)
      }
    }
  })

  it('is about Uno sized, flat on the ground', () => {
    const { group } = createUnoBoard()
    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThanOrEqual(6)
    expect(size.x).toBeLessThanOrEqual(8)
    expect(size.z).toBeGreaterThanOrEqual(5)
    expect(size.z).toBeLessThanOrEqual(7)
    expect(box.min.y).toBeCloseTo(0, 3)
    expect(size.y).toBeLessThan(size.z)
  })
})
