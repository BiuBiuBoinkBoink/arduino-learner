import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createLed } from '../src/parts/led.js'
import { createResistor, resistorBands } from '../src/parts/resistor.js'
import { WIRE_COLORS, wireCurve, createWire } from '../src/parts/wire.js'

function meshesOf(object) {
  const meshes = []
  object.traverse((child) => {
    if (child.isMesh) meshes.push(child)
  })
  return meshes
}

describe('resistorBands', () => {
  it('reads two digits, a multiplier and gold tolerance', () => {
    expect(resistorBands(220)).toEqual(['red', 'red', 'brown', 'gold'])
    expect(resistorBands(1000)).toEqual(['brown', 'black', 'red', 'gold'])
    expect(resistorBands(10000)).toEqual(['brown', 'black', 'orange', 'gold'])
    expect(resistorBands(10)).toEqual(['brown', 'black', 'black', 'gold'])
  })

  it('throws for values it cannot write', () => {
    expect(() => resistorBands(5)).toThrow()
    expect(() => resistorBands(225)).toThrow()
    expect(() => resistorBands(1e11)).toThrow()
  })
})

describe('wireCurve', () => {
  const from = new THREE.Vector3(-2, 1.012, -2.5)
  const to = new THREE.Vector3(3, 0.852, -1.4)

  it('starts at from and ends at to', () => {
    const curve = wireCurve(from, to)
    expect(curve.getPoint(0).distanceTo(from)).toBeLessThan(1e-9)
    expect(curve.getPoint(1).distanceTo(to)).toBeLessThan(1e-9)
  })

  it('leaves and enters vertically', () => {
    const curve = wireCurve(from, to)
    expect(curve.v1.x).toBe(from.x)
    expect(curve.v1.z).toBe(from.z)
    expect(curve.v1.y).toBeGreaterThan(from.y)
    expect(curve.v2.x).toBe(to.x)
    expect(curve.v2.z).toBe(to.z)
    expect(curve.v2.y).toBeGreaterThan(to.y)
  })

  it('arches at least 1 cm above the higher end, more for longer wires', () => {
    const peak = (a, b) => Math.max(...wireCurve(a, b).getPoints(100).map((p) => p.y))
    expect(peak(from, to)).toBeGreaterThanOrEqual(Math.max(from.y, to.y) + 1)
    const near = new THREE.Vector3(from.x + 0.3, to.y, from.z)
    expect(peak(from, near)).toBeGreaterThanOrEqual(from.y + 1)
    const far = new THREE.Vector3(from.x + 10, to.y, from.z)
    expect(peak(from, far)).toBeGreaterThan(peak(from, to))
  })
})

describe('createWire', () => {
  it('builds a shadow casting tube along the curve', () => {
    const from = new THREE.Vector3(0, 1, 0)
    const to = new THREE.Vector3(2, 0.85, 1)
    const { group, curve } = createWire({ color: 'red', from, to })
    const meshes = meshesOf(group)
    expect(meshes).toHaveLength(1)
    expect(meshes[0].geometry).toBeInstanceOf(THREE.TubeGeometry)
    expect(meshes[0].castShadow).toBe(true)
    expect(curve.getPoint(1).distanceTo(to)).toBeLessThan(1e-9)
  })

  it('has the named colours and throws for unknown ones', () => {
    for (const name of ['red', 'black', 'yellow', 'green', 'blue']) expect(WIRE_COLORS).toHaveProperty(name)
    const from = new THREE.Vector3()
    const to = new THREE.Vector3(1, 0, 0)
    expect(() => createWire({ color: 'pink', from, to })).toThrow('pink')
    expect(() => createWire({ color: 'toString', from, to })).toThrow('toString')
  })
})

describe('createLed', () => {
  const anode = new THREE.Vector3(1, 0.852, 0.3)
  const cathode = new THREE.Vector3(1.254, 0.852, 0.3)

  it('reaches down to the leg points and stands above them', () => {
    const { group } = createLed({ color: 'red', anode, cathode })
    const box = new THREE.Box3().setFromObject(group)
    expect(Math.abs(box.min.y - anode.y)).toBeLessThan(0.02)
    expect(box.max.y).toBeGreaterThan(anode.y + 0.8)
    expect(box.min.x).toBeLessThan(anode.x)
    expect(box.max.x).toBeGreaterThan(cathode.x)
  })

  it('casts shadows from every mesh', () => {
    const { group } = createLed({ color: 'blue', anode, cathode })
    for (const mesh of meshesOf(group)) expect(mesh.castShadow).toBe(true)
  })

  it('starts unlit, setLit(true) glows the lens and setLit(false) turns it off', () => {
    const { group, setLit } = createLed({ color: 'red', anode, cathode })
    expect(typeof setLit).toBe('function')
    const lensMeshes = meshesOf(group).filter((mesh) => mesh.material.transparent)
    expect(lensMeshes).toHaveLength(3)
    const black = new THREE.Color(0x000000)
    for (const mesh of lensMeshes) expect(mesh.material.emissive.equals(black)).toBe(true)
    setLit(true)
    for (const mesh of lensMeshes) {
      expect(mesh.material.emissive.equals(black)).toBe(false)
      expect(mesh.material.emissiveIntensity).toBeGreaterThan(0)
    }
    setLit(false)
    for (const mesh of lensMeshes) expect(mesh.material.emissive.equals(black)).toBe(true)
  })

  it('supports four colours and throws for others', () => {
    for (const color of ['red', 'green', 'yellow', 'blue']) {
      expect(() => createLed({ color, anode, cathode })).not.toThrow()
    }
    expect(() => createLed({ color: 'white', anode, cathode })).toThrow('white')
  })
})

describe('createResistor', () => {
  const from = new THREE.Vector3(-0.5, 0.852, 0)
  const to = new THREE.Vector3(0.516, 0.852, 0)

  it('reaches down to the leg points and lies above them', () => {
    const { group } = createResistor({ ohms: 220, from, to })
    const box = new THREE.Box3().setFromObject(group)
    expect(Math.abs(box.min.y - from.y)).toBeLessThan(0.02)
    expect(box.max.y).toBeGreaterThan(from.y + 0.2)
    expect(box.min.x).toBeLessThanOrEqual(from.x)
    expect(box.max.x).toBeGreaterThanOrEqual(to.x)
  })

  it('carries the four bands in order from the from end', () => {
    const { group } = createResistor({ ohms: 220, from, to })
    const bands = []
    group.traverse((child) => {
      if (child.name.startsWith('band-')) bands.push(child)
    })
    group.updateMatrixWorld(true)
    const x = (band) => band.getWorldPosition(new THREE.Vector3()).x
    bands.sort((a, b) => x(a) - x(b))
    expect(bands.map((band) => band.name)).toEqual(['band-red', 'band-red', 'band-brown', 'band-gold'])
  })

  it('casts shadows from the body and legs', () => {
    const { group } = createResistor({ ohms: 220, from, to })
    for (const mesh of meshesOf(group)) {
      if (!mesh.name.startsWith('band-')) expect(mesh.castShadow).toBe(true)
    }
  })
})
